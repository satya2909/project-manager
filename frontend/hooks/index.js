import { useState, useEffect, useCallback, useRef } from "react";
import {
  projectsApi,
  tasksApi,
  notesApi,
  activityApi,
  parseApiError,
} from "../api";
import { tempId } from "../utils/index.js";



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

// ─── useTimeline ────────────────────────────────────────────────────────────
// Fetches GET /tasks/:projectId/timeline. Separate from useTasks() — the
// timeline payload is lighter (no attachments/subtasks) and the collapsible
// TimelineSection only needs to fetch once it's expanded. rescheduleTask()
// is Phase 4's drag-to-reschedule/resize mutation; updateDependencies() is
// Phase 5's dependency-link mutation — both share the same optimistic-update
// + rollback pattern as useTasks().updateTask.
export function useTimeline(projectId, { enabled = true } = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const pendingUpdates = useRef(new Map());

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await tasksApi.listTimeline(projectId);
      setTasks(data?.data?.tasks ?? []);
      setHasFetched(true);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (enabled && !hasFetched) {
      fetch();
    }
  }, [enabled, hasFetched, fetch]);

  const rescheduleTask = async (taskId, payload) => {
    const updateKey = `${taskId}_${Date.now()}`;
    pendingUpdates.current.set(taskId, updateKey);

    // Capture `previous` INSIDE the functional updater, not via a direct
    // `tasks.find(...)` read beforehand — the direct read closes over
    // whatever `tasks` was at render time, which is stale if a second
    // mutation on the same task fires before the first one resolves (e.g.
    // two quick drags). The functional form always sees the latest pending
    // state, so rollback restores the right snapshot either way.
    let previous;
    setTasks((prev) => {
      previous = prev.find((t) => t._id === taskId);
      return prev.map((t) => (t._id === taskId ? { ...t, ...payload } : t));
    });

    try {
      const { data } = await tasksApi.updateSchedule(projectId, taskId, payload);
      const serverTask = data?.data?.task;
      if (pendingUpdates.current.get(taskId) === updateKey) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? { ...t, ...serverTask } : t)),
        );
      }
      return { success: true };
    } catch (err) {
      // Roll back to the pre-drag dates rather than a full refetch — keeps
      // the rest of the board (including other tasks' optimistic state)
      // untouched, matches the "toast + snap-back" pattern from the plan.
      // Gated by the SAME pendingUpdates check as the success branch above —
      // without it, a late-failing call whose pending-key was already
      // overwritten by a newer mutation on the same task would stomp that
      // newer mutation's already-committed state with this stale snapshot.
      if (previous && pendingUpdates.current.get(taskId) === updateKey) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? previous : t)),
        );
      }
      return { success: false, error: parseApiError(err) };
    } finally {
      if (pendingUpdates.current.get(taskId) === updateKey) {
        pendingUpdates.current.delete(taskId);
      }
    }
  };

  // dependsOnIds: full desired array of task-id strings (replace semantics,
  // matches PATCH /dependencies). Optimistic entries use a best-effort
  // {_id, title} shape (title looked up from already-loaded `tasks`) so
  // dependency-line rendering doesn't flash broken between the optimistic
  // update and the server's populated response.
  const updateDependencies = async (taskId, dependsOnIds) => {
    const updateKey = `${taskId}_${Date.now()}`;
    pendingUpdates.current.set(taskId, updateKey);

    // Same functional-capture fix as rescheduleTask — see its comment.
    const titleById = new Map(tasks.map((t) => [t._id, t.title]));
    const optimisticDependsOn = dependsOnIds.map((id) => ({
      _id: id,
      title: titleById.get(id) ?? "",
    }));
    let previous;
    setTasks((prev) => {
      previous = prev.find((t) => t._id === taskId);
      return prev.map((t) => (t._id === taskId ? { ...t, dependsOn: optimisticDependsOn } : t));
    });

    try {
      const { data } = await tasksApi.updateDependencies(projectId, taskId, {
        dependsOn: dependsOnIds,
      });
      const serverTask = data?.data?.task;
      if (pendingUpdates.current.get(taskId) === updateKey) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? { ...t, ...serverTask } : t)),
        );
      }
      return { success: true };
    } catch (err) {
      // Snap back to the pre-drag dependency list — same "toast + snap-back"
      // pattern as rescheduleTask, most relevant here for a 409 cycle
      // rejection (the ApiError message is already specific: "This would
      // create a circular dependency"). Gated the same way as
      // rescheduleTask's rollback — see its comment.
      if (previous && pendingUpdates.current.get(taskId) === updateKey) {
        setTasks((prev) => prev.map((t) => (t._id === taskId ? previous : t)));
      }
      return { success: false, error: parseApiError(err) };
    } finally {
      if (pendingUpdates.current.get(taskId) === updateKey) {
        pendingUpdates.current.delete(taskId);
      }
    }
  };

  // Phase 6 (inline creation on the grid). Reuses the general
  // `POST /tasks/:projectId` endpoint (now date-aware) — there's no
  // timeline-specific create route. Optimistic: a temp-id placeholder
  // appears immediately, replaced by the server task on success or removed
  // on failure (same tempId() pattern as elsewhere in this codebase).
  const createTask = async (payload) => {
    const placeholderId = tempId();
    const placeholder = { _id: placeholderId, dependsOn: [], ...payload };
    setTasks((prev) => [...prev, placeholder]);

    try {
      const { data } = await tasksApi.create(projectId, payload);
      const serverTask = data?.data?.task;
      setTasks((prev) =>
        prev.map((t) => (t._id === placeholderId ? { ...serverTask, dependsOn: [] } : t)),
      );
      return { success: true, data: serverTask };
    } catch (err) {
      setTasks((prev) => prev.filter((t) => t._id !== placeholderId));
      return { success: false, error: parseApiError(err) };
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch: fetch,
    rescheduleTask,
    updateDependencies,
    createTask,
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
