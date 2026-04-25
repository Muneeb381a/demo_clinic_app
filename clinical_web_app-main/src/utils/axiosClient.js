import axios from "axios";

// Always use relative /api paths.
// Dev:  Vite proxy (vite.config.js) forwards them to localhost:4500
// Prod: Vercel rewrite (vercel.json) forwards them to demo-clinic-app.vercel.app
// No cross-origin requests → no CORS issues in either environment.
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
