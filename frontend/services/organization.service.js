import api from "../api/index.js";

// ── helper ───────────────────────────────────────────────────────────────────
const d = (res) => res.data?.data; // unwrap { success, data, message }

// ── organization service ──────────────────────────────────────────────────────
const organizationService = {
  /** GET /organizations/me */
  getMyOrg: async () => {
    const res = await api.get("/organizations/me");
    return d(res); // { organization }
  },

  /** PUT /organizations — owner/admin; { name } */
  updateOrg: async (payload) => {
    const res = await api.put("/organizations", payload);
    return d(res); // { organization }
  },

  /** DELETE /organizations — owner only; requires current password; blocks if non-empty */
  deleteOrg: async (password) => {
    const res = await api.delete("/organizations", { data: { password } });
    return d(res);
  },

  /** GET /organizations/members */
  listMembers: async () => {
    const res = await api.get("/organizations/members");
    return d(res); // { members }
  },

  /** PUT /organizations/members/:userId — owner only; { role } */
  updateMemberRole: async (userId, payload) => {
    const res = await api.put(`/organizations/members/${userId}`, payload);
    return d(res); // { member }
  },

  /** DELETE /organizations/members/:userId — owner/admin; deactivate */
  deactivateMember: async (userId) => {
    const res = await api.delete(`/organizations/members/${userId}`);
    return d(res);
  },
};

export default organizationService;
