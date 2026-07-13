import axios from "axios";

// ─── BASE INSTANCE ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── TOKEN HELPERS ────────────────────────────────────────────────────────────
export const getAccessToken = () => localStorage.getItem("access_token");
export const setAccessToken = (token) =>
  localStorage.setItem("access_token", token);
export const clearAccessToken = () => localStorage.removeItem("access_token");

// ─── REQUEST INTERCEPTOR ─────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── RESPONSE INTERCEPTOR — 401 + silent refresh ─────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh-token")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post("/auth/refresh-token");
        const newToken = data?.data?.accessToken;
        if (newToken) {
          setAccessToken(newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  currentUser: () => api.get("/auth/current-user"),
  changePassword: (data) => api.post("/auth/change-password", data),
  refreshToken: () => api.post("/auth/refresh-token"),
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}`),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword: (token, data) =>
    api.post(`/auth/reset-password/${token}`, data),
  resendVerification: () => api.post("/auth/resend-email-verification"),
};

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
export const orgApi = {
  me: () => api.get("/organizations/me"),
  update: (data) => api.put("/organizations", data),
  remove: () => api.delete("/organizations"),
  listMembers: () => api.get("/organizations/members"),
  updateMemberRole: (userId, data) =>
    api.put(`/organizations/members/${userId}`, data),
  deactivateMember: (userId) =>
    api.delete(`/organizations/members/${userId}`),
};

// ─── INVITES ──────────────────────────────────────────────────────────────────
export const inviteApi = {
  // Public — preview an invite by its raw token (for the accept page).
  preview: (token) => api.get(`/invites/${token}`),
  // Public — complete registration and join the org.
  accept: (token, data) => api.post(`/invites/${token}/accept`, data),
  // Owner/admin — send an invite into the caller's org.
  create: (data) => api.post("/invites", data),
  // Owner/admin — list pending invites for the caller's org.
  list: () => api.get("/invites"),
  // Owner/admin — revoke a pending invite.
  revoke: (inviteId) => api.delete(`/invites/${inviteId}`),
};

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get("/projects"),
  create: (data) => api.post("/projects", data),
  get: (projectId) => api.get(`/projects/${projectId}`),
  update: (projectId, data) => api.put(`/projects/${projectId}`, data),
  delete: (projectId) => api.delete(`/projects/${projectId}`),
  listMembers: (projectId) => api.get(`/projects/${projectId}/members`),
  addMember: (projectId, data) =>
    api.post(`/projects/${projectId}/members`, data),
  updateMember: (projectId, userId, data) =>
    api.put(`/projects/${projectId}/members/${userId}`, data),
  removeMember: (projectId, userId) =>
    api.delete(`/projects/${projectId}/members/${userId}`),
};

// ─── TASKS ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (projectId) => api.get(`/tasks/${projectId}`),
  listMine: () => api.get("/tasks/me"),
  create: (projectId, data) => api.post(`/tasks/${projectId}`, data),
  get: (projectId, taskId) => api.get(`/tasks/${projectId}/t/${taskId}`),
  update: (projectId, taskId, data) =>
    api.put(`/tasks/${projectId}/t/${taskId}`, data),
  delete: (projectId, taskId) => api.delete(`/tasks/${projectId}/t/${taskId}`),
  createSubtask: (projectId, taskId, data) =>
    api.post(`/tasks/${projectId}/t/${taskId}/subtasks`, data),
  updateSubtask: (projectId, subTaskId, data) =>
    api.put(`/tasks/${projectId}/st/${subTaskId}`, data),
  deleteSubtask: (projectId, subTaskId) =>
    api.delete(`/tasks/${projectId}/st/${subTaskId}`),
  uploadAttachment: (projectId, taskId, formData) =>
    api.post(`/tasks/${projectId}/t/${taskId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ─── NOTES ────────────────────────────────────────────────────────────────────
export const notesApi = {
  list: (projectId) => api.get(`/notes/${projectId}`),
  create: (projectId, data) => api.post(`/notes/${projectId}`, data),
  get: (projectId, noteId) => api.get(`/notes/${projectId}/n/${noteId}`),
  update: (projectId, noteId, data) =>
    api.put(`/notes/${projectId}/n/${noteId}`, data),
  delete: (projectId, noteId) => api.delete(`/notes/${projectId}/n/${noteId}`),
};

// ─── ACTIVITY ─────────────────────────────────────────────────────────────────
export const activityApi = {
  list: (projectId, params = {}) =>
    api.get(`/activity/${projectId}`, { params }),
};

// ─── HEALTH ───────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get("/healthcheck"),
};

// ─── ERROR PARSER ─────────────────────────────────────────────────────────────
export const parseApiError = (error) => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.response?.data?.errors?.length) {
    return error.response.data.errors.join(", ");
  }
  if (error?.message) {
    return error.message;
  }
  return "An unexpected error occurred";
};

export default api;
