import axios from "axios";

// In dev: no baseURL, Vite proxy forwards /api → localhost:4500 (no CORS)
// In prod: baseURL from env, direct calls to the deployed backend
const apiClient = axios.create({
  baseURL: import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL || ""),
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and reload so the login screen is shown
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default apiClient;
