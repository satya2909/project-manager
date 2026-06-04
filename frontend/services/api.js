import axios from "axios";

// ── base instance ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  withCredentials: true, // send httpOnly refresh-token cookie
  headers: { "Content-Type": "application/json" },
});

// ── token store (in-memory; survives re-renders, cleared on tab close) ────────
let _accessToken = null;

export const setAccessToken = (t) => {
  _accessToken = t;
};
export const clearAccessToken = () => {
  _accessToken = null;
};
export const getAccessToken = () => _accessToken;

// ── request interceptor — attach Bearer token ─────────────────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── response interceptor — silent refresh on 401 ─────────────────────────────
let _refreshPromise = null; // deduplicate concurrent refresh calls

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only attempt refresh once per request; skip refresh endpoint itself
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/refresh-token")
    ) {
      original._retry = true;

      try {
        // Deduplicate: if another request already triggered a refresh, wait for it
        if (!_refreshPromise) {
          _refreshPromise = api.post("/auth/refresh-token").finally(() => {
            _refreshPromise = null;
          });
        }
        const { data } = await _refreshPromise;
        const newToken = data?.data?.accessToken;
        if (newToken) {
          setAccessToken(newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original); // retry original request
        }
      } catch (_) {
        // Refresh itself failed → force logout
        clearAccessToken();
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }

    return Promise.reject(err);
  },
);

// ── convenience wrappers ──────────────────────────────────────────────────────
export const get = (url, cfg) => api.get(url, cfg);
export const post = (url, data, cfg) => api.post(url, data, cfg);
export const put = (url, data, cfg) => api.put(url, data, cfg);
export const patch = (url, data, cfg) => api.patch(url, data, cfg);
export const del = (url, cfg) => api.delete(url, cfg);

export default api;
