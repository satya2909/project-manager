import api from "../api/index.js";

const d = (res) => res.data?.data;

// ── task service ──────────────────────────────────────────────────────────────
const taskService = {
  // ── tasks ────────────────────────────────────────────────────────────────────

  /**
   * GET /tasks/:projectId — list all tasks for a project
   */
  listTasks: async (projectId) => {
    const res = await api.get(`/tasks/${projectId}`);
    return d(res);
  },

  /**
   * POST /tasks/:projectId  (Admin / Project Admin)
   * Supports file attachments via multipart/form-data.
   * @param {string} projectId
   * @param {{ title: string, description?: string, assigneeId?: string, status?: string, priority?: string }} payload
   * @param {File[]} [files]
   */
  createTask: async (projectId, payload, files = []) => {
    let body;
    let headers = {};

    if (files.length > 0) {
      body = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) body.append(k, v);
      });
      files.forEach((f) => body.append("attachments", f));
      headers["Content-Type"] = "multipart/form-data";
    } else {
      body = payload;
    }

    const res = await api.post(`/tasks/${projectId}`, body, { headers });
    return d(res);
  },

  /**
   * GET /tasks/:projectId/t/:taskId
   */
  getTask: async (projectId, taskId) => {
    const res = await api.get(`/tasks/${projectId}/t/${taskId}`);
    return d(res);
  },

  /**
   * PUT /tasks/:projectId/t/:taskId  (Admin / Project Admin)
   * Also accepts files for attachment updates.
   * @param {string} projectId
   * @param {string} taskId
   * @param {object} payload
   * @param {File[]} [files]
   */
  updateTask: async (projectId, taskId, payload, files = []) => {
    let body;
    let headers = {};

    if (files.length > 0) {
      body = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) body.append(k, v);
      });
      files.forEach((f) => body.append("attachments", f));
      headers["Content-Type"] = "multipart/form-data";
    } else {
      body = payload;
    }

    const res = await api.put(`/tasks/${projectId}/t/${taskId}`, body, {
      headers,
    });
    return d(res);
  },

  /**
   * DELETE /tasks/:projectId/t/:taskId  (Admin / Project Admin)
   */
  deleteTask: async (projectId, taskId) => {
    const res = await api.delete(`/tasks/${projectId}/t/${taskId}`);
    return d(res);
  },

  // ── subtasks ─────────────────────────────────────────────────────────────────

  /**
   * POST /tasks/:projectId/t/:taskId/subtasks  (Admin / Project Admin)
   * @param {string} projectId
   * @param {string} taskId
   * @param {{ title: string }} payload
   */
  createSubtask: async (projectId, taskId, payload) => {
    const res = await api.post(
      `/tasks/${projectId}/t/${taskId}/subtasks`,
      payload,
    );
    return d(res);
  },

  /**
   * PUT /tasks/:projectId/st/:subTaskId  (role-based — members can toggle isCompleted)
   * @param {string} projectId
   * @param {string} subTaskId
   * @param {{ title?: string, isCompleted?: boolean }} payload
   */
  updateSubtask: async (projectId, subTaskId, payload) => {
    const res = await api.put(`/tasks/${projectId}/st/${subTaskId}`, payload);
    return d(res);
  },

  /**
   * DELETE /tasks/:projectId/st/:subTaskId  (Admin / Project Admin)
   */
  deleteSubtask: async (projectId, subTaskId) => {
    const res = await api.delete(`/tasks/${projectId}/st/${subTaskId}`);
    return d(res);
  },

  // ── AI DoD verification (plans/ai-dod-plan.md Phase 5) ─────────────────────

  /**
   * GET /tasks/:projectId/t/:taskId/ai-logs — paginated evaluation history
   */
  getAiLogs: async (projectId, taskId, params = {}) => {
    const res = await api.get(`/tasks/${projectId}/t/${taskId}/ai-logs`, { params });
    return d(res);
  },

  /**
   * PUT /tasks/:projectId/t/:taskId/requirements  (Admin / Project Admin)
   * @param {{ requirements: Array<{_id?: string, text: string, active?: boolean}> }} payload
   */
  updateRequirements: async (projectId, taskId, payload) => {
    const res = await api.put(`/tasks/${projectId}/t/${taskId}/requirements`, payload);
    return d(res);
  },

  /**
   * POST /tasks/:projectId/t/:taskId/ai-evaluate  (Admin / Project Admin) — "Verify now"
   */
  requestAiEvaluate: async (projectId, taskId, payload = {}) => {
    const res = await api.post(`/tasks/${projectId}/t/${taskId}/ai-evaluate`, payload);
    return d(res);
  },
};

export default taskService;
