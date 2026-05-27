import api, { setAccessToken, clearAccessToken } from "./api.js";

// ── helpers ───────────────────────────────────────────────────────────────────
const d = (res) => res.data?.data; // unwrap { success, data, message }

// ── auth service ──────────────────────────────────────────────────────────────
const authService = {
  /**
   * POST /auth/register
   * @param {{ username: string, email: string, password: string }} payload
   */
  register: async (payload) => {
    const res = await api.post("/auth/register", payload);
    return d(res);
  },

  /**
   * POST /auth/login
   * Returns user + accessToken; stores token in memory.
   * @param {{ email: string, password: string }} payload
   */
  login: async ({ email, password }) => {
    const res = await api.post("/auth/login", { email, password });
    const data = d(res);
    if (data?.accessToken) setAccessToken(data.accessToken);
    return data; // { user, accessToken }
  },

  /**
   * POST /auth/logout — clears server session + in-memory token
   */
  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (_) {
      /* swallow */
    }
    clearAccessToken();
  },

  /**
   * GET /auth/current-user
   */
  getCurrentUser: async () => {
    const res = await api.get("/auth/current-user");
    return d(res);
  },

  /**
   * POST /auth/refresh-token — called automatically by interceptor;
   * exposed here for manual use (e.g. on app boot).
   */
  refreshToken: async () => {
    const res = await api.post("/auth/refresh-token");
    const data = d(res);
    if (data?.accessToken) setAccessToken(data.accessToken);
    return data;
  },

  /**
   * POST /auth/change-password
   * @param {{ oldPassword: string, newPassword: string }} payload
   */
  changePassword: async (payload) => {
    const res = await api.post("/auth/change-password", payload);
    return d(res);
  },

  /**
   * GET /auth/verify-email/:token
   */
  verifyEmail: async (token) => {
    const res = await api.get(`/auth/verify-email/${token}`);
    return d(res);
  },

  /**
   * POST /auth/forgot-password
   * @param {{ email: string }} payload
   */
  forgotPassword: async ({ email }) => {
    const res = await api.post("/auth/forgot-password", { email });
    return d(res);
  },

  /**
   * POST /auth/reset-password/:token
   * @param {string} token
   * @param {{ newPassword: string }} payload
   */
  resetPassword: async (token, { newPassword }) => {
    const res = await api.post(`/auth/reset-password/${token}`, {
      newPassword,
    });
    return d(res);
  },

  /**
   * POST /auth/resend-email-verification
   */
  resendVerification: async () => {
    const res = await api.post("/auth/resend-email-verification");
    return d(res);
  },
};

export default authService;
