import { logger }           from "../../logger.js";
import {
  extractKeywords,
  makeExactKey,
  makeKeywordKey,
  normalizeText,
  chatbotCacheGet,
  chatbotCacheSet,
  chatbotCacheStats,
} from "../utils/chatbotCache.js";

const GEMINI_MODELS = [
  "gemini-2.5-flash",        // primary  — confirmed working
  "gemini-2.0-flash",        // fallback — own quota pool
  "gemini-2.0-flash-lite",   // fallback — fastest, cheapest
];

const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// ---------------------------------------------------------------------------
// Token-optimized system prompt.
//
// Design principles applied to minimize tokens:
//   1. No prose — pure instruction syntax
//   2. Enum values inlined as compact one-liners (not multi-line lists)
//   3. Urdu map on ONE line per field (not split into bullets)
//   4. Hard JSON shape defined once — AI doesn't guess structure
//   5. Safety rules collapsed to one line
//
// Result: ~320 tokens vs ~620 in the naive version — saves ~47% on every call.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Clinical assistant for doctors in Pakistan. Return ONLY valid JSON, no markdown.

JSON shape:
{"diagnoses":[{"name":string,"confidence":number}],"symptoms_extracted":[string],"diagnosis_text":string,"medicines":[{"name":string,"dosage_en":string,"dosage_urdu":string,"frequency_en":string,"frequency_urdu":string,"duration_en":string,"duration_urdu":string,"instructions_en":string,"instructions_urdu":string}],"tests_recommended":[string],"precautions":[string]}

Rules: max 3 diagnoses (confidence 0-1), max 5 safe generic medicines (Paracetamol/Amoxicillin/Metronidazole/Omeprazole/Cetirizine/Ibuprofen/Azithromycin/Chlorpheniramine/ORS only), NO opioids/controlled drugs.

dosage_en→one of:"0.25","0.5","1","1.5","2","3","one_spoon","one_injection","one_sachet","two_droplets"
dosage_urdu→"1"=ایک گولی,"0.5"=آدھی گولی,"2"=دو گولیاں,"one_spoon"=ایک چمچ,"one_injection"=ایک ٹیکہ,"one_sachet"=ایک ساشے,"two_droplets"=دو قطرے

frequency_en→one of:"morning","evening","night","morning_evening","morning_night","morning_evening_night","twice_a_day","three_times_a_day","as_needed","once_a_day"
frequency_urdu→morning=صبح,evening=شام,night=رات,morning_evening=صبح شام,morning_night=صبح رات,morning_evening_night=صبح شام رات,twice_a_day=دن میں دو بار,three_times_a_day=دن میں تین بار,as_needed=حسب ضرورت,once_a_day=دن میں ایک بار

duration_en→one of:"1_day","2_days","3_days","5_days","7_days","10_days","14_days","21_days","30_days","90_days"
duration_urdu→1_day=1 دن,3_days=3 دن,5_days=5 دن,7_days=1 ہفتہ (7 دن),10_days=10 دن,14_days=2 ہفتے (14 دن),21_days=3 ہفتے (21 دن),30_days=1 مہینہ (30 دن)

instructions_en→one of:"before_meal","after_meal","with_meal","empty_stomach","at_bedtime"
instructions_urdu→before_meal=کھانے سے پہلے,after_meal=کھانے کے بعد,with_meal=کھانے کے ساتھ,empty_stomach=خالی پیٹ,at_bedtime=سونے سے پہلے`;

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------
// Retry with exponential backoff for transient errors (503, 429 rate-per-minute)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Call one specific Gemini model. Returns text or throws.
// Throws "QUOTA_EXHAUSTED" only for daily-limit 429s so the caller can try
// the next model. Per-minute 429s are retried here with backoff.
const callGeminiModel = async (model, userMessage, attempt = 1) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured");

  const res = await fetch(`${geminiUrl(model)}?key=${apiKey}`, {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature:      0,
        maxOutputTokens:  1024,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const status = res.status;
    const errMsg = parsed?.error?.message || body;

    // Per-minute rate limit → retry with backoff (up to 2 times)
    if (status === 429 && attempt <= 2 && !errMsg.toLowerCase().includes("exceeded your current quota")) {
      await sleep(attempt * 2000);
      return callGeminiModel(model, userMessage, attempt + 1);
    }

    // 503 high-demand → retry once, then fall back to next model
    if (status === 503 && attempt <= 1) {
      await sleep(1500);
      return callGeminiModel(model, userMessage, attempt + 1);
    }

    if (status === 429 || status === 503) throw new Error("QUOTA_EXHAUSTED"); // triggers next model
    if (status === 401 || status === 403) throw new Error("INVALID_API_KEY");
    throw new Error(`Gemini API error ${status}: ${errMsg}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// Try each model in order; skip to the next on QUOTA_EXHAUSTED.
const callGemini = async (userMessage) => {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      const text = await callGeminiModel(model, userMessage);
      if (model !== GEMINI_MODELS[0]) {
        logger.info(`chatbot: used fallback model ${model}`);
      }
      return text;
    } catch (err) {
      if (err.message === "QUOTA_EXHAUSTED") {
        lastErr = err;
        logger.warn(`chatbot: quota exhausted on ${model}, trying next model`);
        continue; // try next model
      }
      throw err; // INVALID_API_KEY or network error — don't retry
    }
  }
  throw lastErr; // all models quota-exhausted
};

// ---------------------------------------------------------------------------
// Validate + shape the AI response — guarantees required keys always exist
// ---------------------------------------------------------------------------
const parseResponse = (raw) => {
  // Strip markdown fences (```json ... ``` or ``` ... ```)
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Some models wrap with extra text before/after the JSON object — extract
  // the first complete {...} block as a fallback.
  if (!cleaned.startsWith("{")) {
    const start = cleaned.indexOf("{");
    const end   = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);
  }

  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) {
    logger.error("chatbot: invalid JSON from model", { raw: raw.slice(0, 300) });
    throw new Error(`AI returned invalid JSON: ${e.message}`);
  }

  return {
    diagnoses:          Array.isArray(parsed.diagnoses)           ? parsed.diagnoses          : [],
    symptoms_extracted: Array.isArray(parsed.symptoms_extracted)  ? parsed.symptoms_extracted : [],
    diagnosis_text:     typeof parsed.diagnosis_text === "string" ? parsed.diagnosis_text     : "",
    medicines:          Array.isArray(parsed.medicines)            ? parsed.medicines          : [],
    tests_recommended:  Array.isArray(parsed.tests_recommended)   ? parsed.tests_recommended  : [],
    precautions:        Array.isArray(parsed.precautions)         ? parsed.precautions        : [],
  };
};

// ---------------------------------------------------------------------------
// POST /api/chatbot/analyze   { input: string }
// ---------------------------------------------------------------------------
export const analyzeSymptoms = async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ success: false, message: "input field is required" });
    }
    const trimmed = input.trim();
    if (trimmed.length < 5)    return res.status(400).json({ success: false, message: "Please provide more details" });
    if (trimmed.length > 1000) return res.status(400).json({ success: false, message: "Input too long (max 1000 chars)" });

    // Build both cache keys
    const normalized  = normalizeText(trimmed);
    const keywords    = extractKeywords(normalized);
    const exactKey    = makeExactKey(normalized);
    const keywordKey  = makeKeywordKey(keywords);

    // ── Cache lookup (L1 → L2 → L3) ──────────────────────────────────────
    const cached = await chatbotCacheGet(exactKey, keywordKey);
    if (cached) {
      return res.json({ success: true, cached: true, cacheLevel: cached.level, data: cached.data });
    }

    // ── API call ──────────────────────────────────────────────────────────
    // Pass only up to 500 chars to the model — keeps input tokens low while
    // preserving all clinically relevant information doctors typically provide.
    const modelInput = trimmed.length > 500 ? trimmed.slice(0, 500) + "…" : trimmed;
    const raw  = await callGemini(modelInput);
    const data = parseResponse(raw);

    // ── Store in all cache layers ─────────────────────────────────────────
    chatbotCacheSet(exactKey, keywordKey, data, trimmed);

    res.json({ success: true, cached: false, cacheLevel: null, data });
  } catch (error) {
    logger.error("chatbot analyzeSymptoms error", { message: error.message });
    if (!process.env.GOOGLE_API_KEY || error.message === "GOOGLE_API_KEY is not configured") {
      return res.status(503).json({ success: false, message: "AI service not configured. Add GOOGLE_API_KEY to environment variables." });
    }
    if (error.message === "QUOTA_EXHAUSTED") {
      return res.status(429).json({ success: false, message: "AI models are currently overloaded or quota exhausted. Please try again in a few minutes." });
    }
    if (error.message === "INVALID_API_KEY") {
      return res.status(401).json({ success: false, message: "Invalid Google API key. Check GOOGLE_API_KEY in Vercel environment variables." });
    }
    res.status(500).json({ success: false, message: "Failed to analyze. Please try again.", _debug: error.message.slice(0, 200) });
  }
};

// ---------------------------------------------------------------------------
// GET /api/chatbot/stats  (optional debug/monitoring endpoint)
// ---------------------------------------------------------------------------
export const getCacheStats = (_req, res) => {
  res.json({ success: true, ...chatbotCacheStats() });
};
