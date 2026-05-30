import { useState, useEffect, useCallback } from "react";
import projectService from "../services/project.service.js";
import taskService from "../services/task.service.js";
import noteService from "../services/note.service.js";

// ── parseApiError helper ──────────────────────────────────────────────────────
const parseApiError = (err) => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response?.data?.errors?.length)
    return err.response.data.errors.map((e) => e.message).join(", ");
  return err?.message || "An unexpected error occurred";
};

// ─── useProjects ──────────────────────────────────────────────────────────────
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.listProjects();
      setProjects(data ?? []);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createProject = async (payload) => {
    try {
      const data = await projectService.createProject(payload);
      setProjects((prev) => [data, ...prev]);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateProject = async (id, payload) => {
    try {
      const data = await projectService.updateProject(id, payload);
      setProjects((prev) =>
        prev.map((p) => (p._id === id ? { ...p, ...data } : p)),
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const deleteProject = async (id) => {
    try {
      await projectService.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  return {
    projects,
    loading,
    error,
    refetch: fetch,
    createProject,
    updateProject,
    deleteProject,
  };
}

// ─── useProject (single) ──────────────────────────────────────────────────────
export function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.getProject(projectId);
      setProject(data ?? null);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { project, loading, error, refetch: fetch, setProject };
}

// ─── useMembers ───────────────────────────────────────────────────────────────
export function useMembers(projectId) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.listMembers(projectId);
      setMembers(data ?? []);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addMember = async (email, role) => {
    try {
      const data = await projectService.addMember(projectId, { email, role });
      setMembers((prev) => [...prev, data]);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateMember = async (userId, role) => {
    try {
      await projectService.updateMemberRole(projectId, userId, { role });
      setMembers((prev) =>
        prev.map((m) => (m.user?._id === userId ? { ...m, role } : m)),
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const removeMember = async (userId) => {
    try {
      await projectService.removeMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.user?._id !== userId));
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  return {
    members,
    loading,
    error,
    refetch: fetch,
    addMember,
    updateMember,
    removeMember,
  };
}

// ─── useTasks ─────────────────────────────────────────────────────────────────
export function useTasks(projectId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await taskService.listTasks(projectId);
      setTasks(data?.tasks ?? data ?? []);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createTask = async (payload) => {
    try {
      const data = await taskService.createTask(projectId, payload);
      setTasks((prev) => [...prev, data]);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateTask = async (taskId, payload) => {
    // optimistic
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, ...payload } : t)),
    );
    try {
      const data = await taskService.updateTask(projectId, taskId, payload);
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, ...data } : t)),
      );
      return { success: true };
    } catch (err) {
      fetch(); // rollback
      return { success: false, error: parseApiError(err) };
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await taskService.deleteTask(projectId, taskId);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch: fetch,
    createTask,
    updateTask,
    deleteTask,
    setTasks,
  };
}

// ─── useNotes ─────────────────────────────────────────────────────────────────
export function useNotes(projectId) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await noteService.listNotes(projectId);
      setNotes(data?.notes ?? data ?? []);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createNote = async (payload) => {
    try {
      const data = await noteService.createNote(projectId, payload);
      setNotes((prev) => [data, ...prev]);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateNote = async (noteId, payload) => {
    try {
      const data = await noteService.updateNote(projectId, noteId, payload);
      setNotes((prev) =>
        prev.map((n) => (n._id === noteId ? { ...n, ...data } : n)),
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await noteService.deleteNote(projectId, noteId);
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  return {
    notes,
    loading,
    error,
    refetch: fetch,
    createNote,
    updateNote,
    deleteNote,
  };
}
