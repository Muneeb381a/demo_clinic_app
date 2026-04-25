/**
 * chatbotCache.js — Three-level cache for AI chatbot responses.
 *
 * Level 1 — process Map  : 0 ms  · 500 entries · 5 min TTL  (per-process, lost on restart)
 * Level 2 — Redis        : ~2 ms · unlimited   · 1 h  TTL  (shared across instances)
 * Level 3 — PostgreSQL   : ~10ms · unlimited   · 30 d TTL  (persistent across deploys)
 *
 * Two cache keys per response:
 *   exactKey   — SHA-256(full normalized text)  → catches identical inputs
 *   keywordKey — MD5(sorted medical keywords)   → catches "fever cough" == "cough and fever for 3 days"
 *
 * Lookup order: L1[exact] → L1[keyword] → L2[exact] → L2[keyword] → L3[exact] → L3[keyword] → API
 * Each hit promotes the value to all faster layers for next time.
 */

import crypto   from "crypto";
import { cacheGet, cacheSet } from "./cache.js";
import { pool }               from "../models/db.js";
import { logger }             from "../../logger.js";

// ── L1 in-process cache ────────────────────────────────────────────────────
const L1         = new Map();   // key → { value, exp }
const L1_MAX     = 500;         // prevent unbounded memory growth
const L1_TTL_MS  = 5 * 60 * 1000;

const l1Get = (key) => {
  const entry = L1.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) { L1.delete(key); return null; }
  return entry.value;
};

const l1Set = (key, value) => {
  if (L1.size >= L1_MAX) {
    // Evict oldest insertion (Map preserves insertion order)
    L1.delete(L1.keys().next().value);
  }
  L1.set(key, { value, exp: Date.now() + L1_TTL_MS });
};

// ── Redis TTL ──────────────────────────────────────────────────────────────
const REDIS_TTL  = 60 * 60;       // 1 hour
const DB_TTL_DAY = 30;            // 30 days

// ── Key prefixes ───────────────────────────────────────────────────────────
const PREFIX = "chatbot:v2:";

// ── Stop-word list — tokens that carry no clinical meaning ─────────────────
const STOP = new Set([
  "the","a","an","is","are","was","were","has","have","had","been","be",
  "with","and","or","for","of","in","on","at","to","from","by","about",
  "patient","doctor","complaint","complaining","presenting","presents",
  "came","come","visit","history","reports","reported","says","said",
  "old","year","years","male","female","man","woman","boy","girl","child",
  "he","she","his","her","this","that","also","since","past","last","ago",
  "no","not","without","some","any","very","quite","much","more","less",
  "day","days","week","weeks","month","months","hour","hours",
]);

// ── Keyword extractor ──────────────────────────────────────────────────────
/**
 * Returns sorted, de-duped medical keywords from free text.
 * "fever cough sore throat" == "sore throat, cough and fever for 3 days"
 * both yield the same keyword set → same keywordKey → cache hit.
 */
export const extractKeywords = (text) =>
  [...new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  )].sort();

// ── Key builders ───────────────────────────────────────────────────────────
export const makeExactKey = (normalizedText) =>
  PREFIX + "e:" + crypto.createHash("sha256").update(normalizedText).digest("hex").slice(0, 20);

export const makeKeywordKey = (keywords) =>
  PREFIX + "k:" + crypto.createHash("md5").update(keywords.join("|")).digest("hex").slice(0, 20);

export const normalizeText = (text) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

// ── L3 — PostgreSQL helpers ────────────────────────────────────────────────
const dbGet = async (exactKey, keywordKey) => {
  try {
    const { rows } = await pool.query(
      `SELECT response FROM chatbot_cache
       WHERE (input_hash = $1 OR keyword_hash = $2)
         AND expires_at > NOW()
       ORDER BY (input_hash = $1) DESC   -- prefer exact match
       LIMIT 1`,
      [exactKey, keywordKey]
    );
    return rows[0]?.response || null;
  } catch {
    return null; // DB cache miss is non-fatal
  }
};

const dbSet = (exactKey, keywordKey, data, inputSample) => {
  pool.query(
    `INSERT INTO chatbot_cache (input_hash, keyword_hash, response, input_sample, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${DB_TTL_DAY} days')
     ON CONFLICT (input_hash) DO UPDATE
       SET hit_count  = chatbot_cache.hit_count + 1,
           expires_at = NOW() + INTERVAL '${DB_TTL_DAY} days'`,
    [exactKey, keywordKey, JSON.stringify(data), inputSample.slice(0, 200)]
  ).catch(() => {}); // fire-and-forget, non-fatal
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up a cached response.
 * Returns { data, level } where level is "L1"|"L2"|"L3", or null on miss.
 */
export const chatbotCacheGet = async (exactKey, keywordKey) => {
  // L1 exact
  let hit = l1Get(exactKey);
  if (hit) return { data: hit, level: "L1" };

  // L1 keyword
  hit = l1Get(keywordKey);
  if (hit) { l1Set(exactKey, hit); return { data: hit, level: "L1" }; }

  // L2 exact
  hit = await cacheGet(exactKey);
  if (hit) { l1Set(exactKey, hit); l1Set(keywordKey, hit); return { data: hit, level: "L2" }; }

  // L2 keyword
  hit = await cacheGet(keywordKey);
  if (hit) {
    l1Set(exactKey, hit);
    l1Set(keywordKey, hit);
    await cacheSet(exactKey, hit, REDIS_TTL); // promote to exact key in Redis too
    return { data: hit, level: "L2" };
  }

  // L3 (PostgreSQL)
  hit = await dbGet(exactKey, keywordKey);
  if (hit) {
    l1Set(exactKey, hit);
    l1Set(keywordKey, hit);
    await cacheSet(exactKey,   hit, REDIS_TTL);
    await cacheSet(keywordKey, hit, REDIS_TTL);
    return { data: hit, level: "L3" };
  }

  return null;
};

/**
 * Store a response in all three cache levels.
 * DB write is fire-and-forget so it never blocks the HTTP response.
 */
export const chatbotCacheSet = (exactKey, keywordKey, data, inputSample) => {
  l1Set(exactKey,   data);
  l1Set(keywordKey, data);
  cacheSet(exactKey,   data, REDIS_TTL).catch(() => {});
  cacheSet(keywordKey, data, REDIS_TTL).catch(() => {});
  dbSet(exactKey, keywordKey, data, inputSample);
};

/**
 * Return L1 stats for health/debug endpoint.
 */
export const chatbotCacheStats = () => ({
  l1_entries: L1.size,
  l1_max:     L1_MAX,
});
