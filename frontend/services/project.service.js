import api from "./api.js";

const d = (res) => res.data?.data;

// ── project service ───────────────────────────────────────────────────────────
const projectService = {
  // ── projects ────────────────────────────────────────────────────────────────

  /**
   * GET /projects — list all projects the current user belongs to
   */
  listProjects: async () => {
    const res = await api.get("/projects");
    return d(res); // [{ _id, name, description, memberCount, ... }]
  },

  /**
   * POST /projects
   * @param {{ name: string, description?: string }} payload
   */
  createProject: async (payload) => {
    const res = await api.post("/projects", payload);
    return d(res);
  },

  /**
   * GET /projects/:projectId
   */
  getProject: async (projectId) => {
    const res = await api.get(`/projects/${projectId}`);
    return d(res);
  },

  /**
   * PUT /projects/:projectId  (Admin only)
   * @param {string} projectId
   * @param {{ name?: string, description?: string }} payload
   */
  updateProject: async (projectId, payload) => {
    const res = await api.put(`/projects/${projectId}`, payload);
    return d(res);
  },

  /**
   * DELETE /projects/:projectId  (Admin only)
   */
  deleteProject: async (projectId) => {
    const res = await api.delete(`/projects/${projectId}`);
    return d(res);
  },

  // ── members ─────────────────────────────────────────────────────────────────

  /**
   * GET /projects/:projectId/members
   */
  listMembers: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/members`);
    return d(res); // [{ _id, name, email, role }]
  },

  /**
   * POST /projects/:projectId/members  (Admin only)
   * @param {string} projectId
   * @param {{ email: string, role?: string }} payload
   */
  addMember: async (projectId, payload) => {
    const res = await api.post(`/projects/${projectId}/members`, payload);
    return d(res);
  },

  /**
   * PUT /projects/:projectId/members/:userId  (Admin only)
   * @param {string} projectId
   * @param {string} userId
   * @param {{ role: string }} payload
   */
  updateMemberRole: async (projectId, userId, payload) => {
    const res = await api.put(
      `/projects/${projectId}/members/${userId}`,
      payload,
    );
    return d(res);
  },

  /**
   * DELETE /projects/:projectId/members/:userId  (Admin only)
   */
  removeMember: async (projectId, userId) => {
    const res = await api.delete(`/projects/${projectId}/members/${userId}`);
    return d(res);
  },
};

export default projectService;
