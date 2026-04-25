// src/utils/cache.js
// Redis cache utility — gracefully degrades to no-cache if REDIS_URL is not set.
// Uses a module-level singleton so the connection is reused across Vercel invocations.

import Redis from "ioredis";

let redis = null;
const enabled = !!process.env.REDIS_URL;

if (enabled) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: false,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 2) return null;
      return Math.min(times * 100, 500);
    },
    tls: process.env.REDIS_URL?.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
  });

  redis.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  redis.on("connect", () => {
    console.log("[Redis] Connected");
  });
}

/**
 * Get a cached value. Returns parsed object or null on miss/error.
 */
export async function cacheGet(key) {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set a value in cache with a TTL in seconds (default 5 minutes).
 */
export async function cacheSet(key, value, ttlSeconds = 300) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // silently ignore write errors
  }
}

/**
 * Delete one or more exact cache keys.
 */
export async function cacheDel(...keys) {
  if (!redis || !keys.length) return;
  try {
    await redis.del(...keys);
  } catch {
    // silently ignore
  }
}

/**
 * Delete all keys matching a pattern (e.g. "patients:*").
 * Uses SCAN to avoid blocking the Redis server.
 */
export async function cacheDelPattern(pattern) {
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // silently ignore
  }
}

/**
 * Stale-While-Revalidate cache helper.
 *
 * How it works:
 *   - Stores data under `key` with a long "hard" TTL (e.g. 1 hour).
 *   - Stores a separate `key:fresh` marker with a short "soft" TTL (e.g. 5 min).
 *   - On a cache hit:
 *       - If `key:fresh` exists → data is fresh, return immediately.
 *       - If `key:fresh` is missing → data is stale. Return the stale data
 *         immediately AND kick off a background DB refresh so next request is fresh.
 *   - On a cache miss (first ever call): fetch synchronously, store both keys.
 *
 * Result: users ALWAYS get an instant response from cache.
 * The DB is only queried in the background when the soft TTL expires.
 *
 * @param {string}   key        Redis key for the data
 * @param {Function} fetchFn    Async function that fetches fresh data from DB
 * @param {number}   hardTtl    How long to keep stale data (seconds). Default: 1 hour.
 * @param {number}   softTtl    How often to silently refresh from DB (seconds). Default: 5 min.
 */
export async function cacheGetSWR(key, fetchFn, hardTtl = 3600, softTtl = 300) {
  const freshKey = `${key}:fresh`;

  if (!redis) {
    // No Redis — always fetch from DB
    return fetchFn();
  }

  try {
    const [raw, isFresh] = await Promise.all([
      redis.get(key),
      redis.exists(freshKey),
    ]);

    if (raw) {
      const data = JSON.parse(raw);

      if (!isFresh) {
        // Stale hit: return immediately, refresh in background
        fetchFn()
          .then(async (fresh) => {
            await Promise.all([
              redis.set(key, JSON.stringify(fresh), "EX", hardTtl),
              redis.set(freshKey, "1", "EX", softTtl),
            ]);
          })
          .catch(() => {}); // background refresh failure is non-fatal
      }

      return data; // always return cached data immediately
    }
  } catch {
    // Redis error — fall through to synchronous fetch
  }

  // Cache miss — fetch from DB and store
  const fresh = await fetchFn();
  try {
    await Promise.all([
      redis.set(key, JSON.stringify(fresh), "EX", hardTtl),
      redis.set(freshKey, "1", "EX", softTtl),
    ]);
  } catch {
    // silently ignore
  }
  return fresh;
}

export const cacheEnabled = enabled;
