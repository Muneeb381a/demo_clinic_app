import axios from "axios";

// Always use relative /api paths.
// Dev:  Vite proxy (vite.config.js) forwards them to localhost:4500
// Prod: Vercel rewrite (vercel.json) forwards them to the backend origin.
// withCredentials sends the httpOnly refresh cookie on /api/auth/* calls.
const apiClient = axios.create({
  timeout: 15000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// This module is the single owner of the in-memory access token; utils/auth.js
// sets it via these hooks (kept minimal to avoid a circular import).
let accessToken = null;
export const _setAccessToken = (t) => { accessToken = t; };
export const _getAccessToken = () => accessToken;

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// On 401, try one silent refresh, then replay the original request. If the
// refresh itself fails, drop the session and bounce to the login screen.
let refreshing = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { response, config } = err;
    const url = config?.url || "";
    const isAuthCall = url.includes("/api/auth/login") || url.includes("/api/auth/refresh");

    if (response?.status !== 401 || config?._retry || isAuthCall) {
      return Promise.reject(err);
    }

    config._retry = true;
    try {
      refreshing = refreshing || apiClient.post("/api/auth/refresh");
      const { data } = await refreshing;
      refreshing = null;
      accessToken = data.accessToken;
      config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(config);
    } catch (refreshErr) {
      refreshing = null;
      accessToken = null;
      // utils/auth.js keeps its own copy; a reload restarts the bootstrap flow
      // which will land on the login screen when the cookie is gone.
      if (typeof window !== "undefined") window.location.reload();
      return Promise.reject(refreshErr);
    }
  }
);

export default apiClient;
