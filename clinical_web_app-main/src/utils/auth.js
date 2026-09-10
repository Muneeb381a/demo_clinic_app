// Client-side auth state.
//
// The access token lives in memory only (never localStorage) so an XSS payload
// can't read it and it dies with the tab. axiosClient is the single owner of
// the token value (its interceptors need it synchronously); this module is a
// thin wrapper that also tracks the current user. The session is restored on
// load and kept alive by the httpOnly refresh cookie via POST /api/auth/refresh.

import apiClient, { _setAccessToken, _getAccessToken } from "./axiosClient";

let currentUser = null;

export const getAccessToken = () => _getAccessToken();
export const getUser = () => currentUser;

export const setSession = ({ accessToken, user } = {}) => {
  _setAccessToken(accessToken ?? null);
  if (user) currentUser = user;
};

export const clearSession = () => {
  _setAccessToken(null);
  currentUser = null;
};

export const login = async (email, password) => {
  const { data } = await apiClient.post("/api/auth/login", { email, password });
  setSession(data);
  return data.user;
};

export const logout = async () => {
  try {
    await apiClient.post("/api/auth/logout");
  } catch {
    // ignore — clear locally regardless
  }
  clearSession();
};

// Called once on app start. Resolves to the user if the refresh cookie is
// still valid, otherwise null.
export const bootstrapSession = async () => {
  try {
    const { data } = await apiClient.post("/api/auth/refresh");
    setSession(data);
    return data.user ?? null;
  } catch {
    clearSession();
    return null;
  }
};
