import { useState, useEffect, useCallback, useRef } from "react";
import {
  projectsApi,
  tasksApi,
  notesApi,
  activityApi,
  parseApiError,
} from "../api";



// ─── useProjects ──────────────────────────────────────────────────────────────
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await projectsApi.list();
      setProjects(data?.data?.projects ?? []);
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
      const { data } = await projectsApi.create(payload);
      setProjects((prev) => [data?.data?.project, ...prev]);
      return { success: true, data: data?.data?.project };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateProject = async (id, payload) => {
    try {
      const { data } = await projectsApi.update(id, payload);
      setProjects((prev) =>
        prev.map((p) => (p._id === id ? { ...p, ...data?.data?.project } : p)),
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const deleteProject = async (id) => {
    try {
      await projectsApi.delete(id);
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
      const { data } = await projectsApi.get(projectId);
      setProject(data?.data?.project ?? null);
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
      const { data } = await projectsApi.listMembers(projectId);
      setMembers(data?.data?.members ?? []);
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
      const { data } = await projectsApi.addMember(projectId, { email, role });
      setMembers((prev) => [...prev, data?.data]);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateMember = async (userId, role) => {
    try {
      await projectsApi.updateMember(projectId, userId, { role });
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
      await projectsApi.removeMember(projectId, userId);
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
  const pendingUpdates = useRef(new Map());

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await tasksApi.list(projectId);
      setTasks(data?.data?.tasks ?? []);
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
      const { data } = await tasksApi.create(projectId, payload);
      const newTask = data?.data?.task;
      setTasks((prev) => [...prev, newTask]);
      return { success: true, data: newTask };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateTask = async (taskId, payload) => {
    const updateKey = `${taskId}_${Date.now()}`;
    pendingUpdates.current.set(taskId, updateKey);

    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, ...payload } : t)),
    );

    try {
      const { data } = await tasksApi.update(projectId, taskId, payload);
      const serverTask = data?.data?.task;

      if (pendingUpdates.current.get(taskId) === updateKey) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? { ...t, ...serverTask } : t)),
        );
      }

      return { success: true };
    } catch (err) {
      await fetch();
      return { success: false, error: parseApiError(err) };
    } finally {
      if (pendingUpdates.current.get(taskId) === updateKey) {
        pendingUpdates.current.delete(taskId);
      }
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await tasksApi.delete(projectId, taskId);
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

// ─── useMyTasks ───────────────────────────────────────────────────────────────
// Cross-project view of tasks assigned to the current user. Every task here is
// assigned to the caller, so status changes are always permitted server-side.
function normalizeMyTask(t) {
  const a = t.assignedTo;
  return {
    ...t,
    assignee: a
      ? { ...a, _id: a._id, name: a.fullName || a.username || "Unknown" }
      : null,
  };
}

export function useMyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await tasksApi.listMine();
      setTasks((data?.data?.tasks ?? []).map(normalizeMyTask));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Optimistic status change. On failure, refetch to restore authoritative
  // state (a status-only change is safe to reload wholesale).
  const updateStatus = async (projectId, taskId, status) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status } : t)),
    );
    try {
      await tasksApi.update(projectId, taskId, { status });
      return { success: true };
    } catch (err) {
      await fetch();
      return { success: false, error: parseApiError(err) };
    }
  };

  return { tasks, loading, error, refetch: fetch, updateStatus, setTasks };
}

// ─── useTaskHub ───────────────────────────────────────────────────────────────
// Org-wide task hub: owners/admins see every task in the org (GET /tasks/org),
// everyone else sees only tasks assigned to them (GET /tasks/me) — same as
// useMyTasks, but that hook stays untouched since CommandPalette relies on it
// always meaning "my" tasks regardless of org role.
export function useTaskHub(isOrgManager) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = isOrgManager
        ? await tasksApi.listOrg()
        : await tasksApi.listMine();
      // /tasks/org doesn't return myRole (every task is manageable by the org
      // manager who fetched it — checkProjectRole already grants org owners/
      // admins effective admin on every project in their org). /tasks/me does
      // return myRole per-task, so leave it as-is for the member path.
      setTasks(
        (data?.data?.tasks ?? []).map((t) => ({
          ...normalizeMyTask(t),
          ...(isOrgManager ? { myRole: "admin" } : {}),
        })),
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [isOrgManager]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Optimistic status change. On failure, refetch to restore authoritative
  // state (a status-only change is safe to reload wholesale).
  const updateStatus = async (projectId, taskId, status) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status } : t)),
    );
    try {
      await tasksApi.update(projectId, taskId, { status });
      return { success: true };
    } catch (err) {
      await fetch();
      return { success: false, error: parseApiError(err) };
    }
  };

  return { tasks, loading, error, refetch: fetch, updateStatus, setTasks };
}

// ─── useTask (single) ─────────────────────────────────────────────────────────
export function useTask(projectId, taskId) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!projectId || !taskId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await tasksApi.get(projectId, taskId);
      setTask(data?.data?.task ?? null);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateSubtask = async (subTaskId, payload) => {
    try {
      const { data } = await tasksApi.updateSubtask(
        projectId,
        subTaskId,
        payload,
      );
      setTask((prev) => ({
        ...prev,
        subtasks: prev.subtasks?.map((s) =>
          s._id === subTaskId ? { ...s, ...data?.data?.subTask } : s,
        ),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const createSubtask = async (payload) => {
    try {
      const { data } = await tasksApi.createSubtask(projectId, taskId, payload);
      setTask((prev) => ({
        ...prev,
        subtasks: [...(prev.subtasks ?? []), data?.data?.subTask],
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const deleteSubtask = async (subTaskId) => {
    try {
      await tasksApi.deleteSubtask(projectId, subTaskId);
      setTask((prev) => ({
        ...prev,
        subtasks: prev.subtasks?.filter((s) => s._id !== subTaskId),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  return {
    task,
    loading,
    error,
    refetch: fetch,
    updateSubtask,
    createSubtask,
    deleteSubtask,
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
      const { data } = await notesApi.list(projectId);
      setNotes(data?.data?.notes ?? []);
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
      const { data } = await notesApi.create(projectId, payload);
      setNotes((prev) => [data?.data?.note, ...prev]);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const updateNote = async (noteId, payload) => {
    try {
      const { data } = await notesApi.update(projectId, noteId, payload);
      setNotes((prev) =>
        prev.map((n) => (n._id === noteId ? { ...n, ...data?.data?.note } : n)),
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await notesApi.delete(projectId, noteId);
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

// ─── useActivity ──────────────────────────────────────────────────────────────
// Fetches the real-time activity feed for a project.
// Polls every 30 seconds to stay fresh without websockets.
export function useActivity(projectId, { limit = 20, poll = true } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      const { data } = await activityApi.list(projectId, { limit });
      setEvents(data?.data?.events ?? []);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Lightweight polling — 30s interval, clears on unmount
  useEffect(() => {
    if (!poll || !projectId) return;
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [fetch, poll, projectId]);

  return { events, loading, error, refetch: fetch };
}
