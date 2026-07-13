import api, { setAccessToken } from "../api/index.js";

// ── helper ───────────────────────────────────────────────────────────────────
const d = (res) => res.data?.data; // unwrap { success, data, message }

// ── invite service ────────────────────────────────────────────────────────────
const inviteService = {
  /**
   * GET /invites/:token — public preview of an invite (org name + role + email).
   */
  preview: async (token) => {
    const res = await api.get(`/invites/${token}`);
    return d(res); // { invite: { email, role, organization } }
  },

  /**
   * POST /invites/:token/accept — complete registration and join the org.
   * The backend sets httpOnly session cookies; it also returns the new user.
   * @param {string} token
   * @param {{ username: string, password: string, fullName?: string }} payload
   */
  accept: async (token, payload) => {
    const res = await api.post(`/invites/${token}/accept`, payload);
    const data = d(res);
    if (data?.accessToken) setAccessToken(data.accessToken);
    return data; // { user }
  },

  /**
   * POST /invites — owner/admin sends an org invite (email + role).
   * @param {{ email: string, role?: string }} payload
   */
  create: async (payload) => {
    const res = await api.post("/invites", payload);
    return d(res);
  },

  /** GET /invites — owner/admin lists pending invites for the org. */
  list: async () => {
    const res = await api.get("/invites");
    return d(res); // { invites }
  },

  /** DELETE /invites/:inviteId — owner/admin revokes a pending invite. */
  revoke: async (inviteId) => {
    const res = await api.delete(`/invites/${inviteId}`);
    return d(res);
  },
};

export default inviteService;
