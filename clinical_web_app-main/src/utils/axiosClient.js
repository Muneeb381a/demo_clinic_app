import axios from "axios";

// No baseURL — all /api requests go through Vite's proxy to localhost:4500
// This avoids CORS entirely in dev, and in production the vercel.json rewrite handles it.
const apiClient = axios.create({
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
