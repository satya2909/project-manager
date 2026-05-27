import api from "./api.js";

const d = (res) => res.data?.data;

// ── note service ──────────────────────────────────────────────────────────────
const noteService = {
  /**
   * GET /notes/:projectId — list all notes for a project
   */
  listNotes: async (projectId) => {
    const res = await api.get(`/notes/${projectId}`);
    return d(res);
  },

  /**
   * POST /notes/:projectId  (Admin only)
   * @param {string} projectId
   * @param {{ title: string, content: string }} payload
   */
  createNote: async (projectId, payload) => {
    const res = await api.post(`/notes/${projectId}`, payload);
    return d(res);
  },

  /**
   * GET /notes/:projectId/n/:noteId
   */
  getNote: async (projectId, noteId) => {
    const res = await api.get(`/notes/${projectId}/n/${noteId}`);
    return d(res);
  },

  /**
   * PUT /notes/:projectId/n/:noteId  (Admin only)
   * @param {string} projectId
   * @param {string} noteId
   * @param {{ title?: string, content?: string }} payload
   */
  updateNote: async (projectId, noteId, payload) => {
    const res = await api.put(`/notes/${projectId}/n/${noteId}`, payload);
    return d(res);
  },

  /**
   * DELETE /notes/:projectId/n/:noteId  (Admin only)
   */
  deleteNote: async (projectId, noteId) => {
    const res = await api.delete(`/notes/${projectId}/n/${noteId}`);
    return d(res);
  },
};

export default noteService;
