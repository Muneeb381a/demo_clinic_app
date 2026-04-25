import apiClient from "./axiosClient";

// Session-level cache for GET requests — cleared on tab close, never stale across sessions.
const SESSION_CACHE_PREFIX = "fc:";
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function sessionCacheGet(key) {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function sessionCacheSet(key, data) {
  try {
    sessionStorage.setItem(
      SESSION_CACHE_PREFIX + key,
      JSON.stringify({ data, expiresAt: Date.now() + SESSION_CACHE_TTL_MS })
    );
  } catch {
    // sessionStorage quota exceeded — silently skip
  }
}

export const fetchWithRetry = async (
  method = "get",
  endpoint,
  cacheKey,
  body,
  transformResponse = (data) => data,
  retries = 2,
  delay = 300
) => {
  let attempt = 1;

  // Return sessionStorage-cached result for GET requests — avoids redundant server calls
  if (method === "get" && cacheKey) {
    const cached = sessionCacheGet(cacheKey);
    if (cached !== null) return cached;
  }

  const timeoutMs = method === "get" ? 8000 : 15000;

  while (attempt <= retries) {
    try {
      const response = await apiClient({
        method,
        url: endpoint,
        data: body,
        timeout: timeoutMs,
      });

      const data = transformResponse(response.data);

      // Cache successful GET responses
      if (method === "get" && cacheKey) {
        sessionCacheSet(cacheKey, data);
      }

      return data;
    } catch (error) {
      const status = error.response?.status;

      // 4xx errors are client mistakes — retrying won't help, throw immediately
      if (status >= 400 && status < 500) {
        throw error;
      }

      if (attempt === retries) {
        throw new Error(`Failed to ${method} ${cacheKey}: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
      delay *= 2; // Exponential backoff
    }
  }
};
