import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMyTasks } from "../../hooks/index.js";
import { projectsApi } from "../../api/index.js";
import TaskDetailDrawer from "../../components/ui/TaskDetailDrawer.jsx";

const STATUS = [
  { value: "todo", label: "TODO", color: "var(--muted)" },
  { value: "in_progress", label: "IN PROGRESS", color: "var(--amber)" },
  { value: "done", label: "DONE", color: "var(--phosphor)" },
];

const isManagerRole = (role) => ["admin", "project_admin"].includes(role);

// ── inline status selector ────────────────────────────────────────────────────
function StatusSelector({ value, onChange }) {
  return (
    <div style={M.statusSel} onClick={(e) => e.stopPropagation()}>
      {STATUS.map((s) => {
        const active = value === s.value;
        return (
          <button
            key={s.value}
            onClick={() => !active && onChange(s.value)}
            style={{
              ...M.statusBtn,
              color: active ? s.color : "var(--muted)",
              borderColor: active ? s.color : "var(--border)",
              background: active ? `${s.color}12` : "transparent",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ── one task row ──────────────────────────────────────────────────────────────
function TaskRow({ task, onStatus, onOpen }) {
  const total = task.subTaskStats?.total ?? 0;
  const done = task.subTaskStats?.completed ?? 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      style={M.row}
      onClick={() => onOpen(task)}
    >
      <div style={M.rowMain}>
        <span style={M.rowId}>#{task._id?.slice(-4).toUpperCase()}</span>
        <span style={M.rowTitle}>{task.title}</span>
      </div>
      <div style={M.rowRight}>
        {total > 0 && (
          <span style={M.rowSub}>
            {done}/{total} ✓
          </span>
        )}
        <StatusSelector value={task.status} onChange={(s) => onStatus(task, s)} />
      </div>
    </motion.div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={M.stat}>
      <span style={{ ...M.statValue, color }}>{value}</span>
      <span style={M.statLabel}>{label}</span>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function MyTasksPage() {
  const { tasks, loading, error, refetch, updateStatus, setTasks } =
    useMyTasks();
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMembers, setDrawerMembers] = useState([]);

  const groups = useMemo(() => {
    const byProject = new Map();
    for (const t of tasks) {
      const pid = t.project?._id || "unknown";
      if (!byProject.has(pid))
        byProject.set(pid, { project: t.project, tasks: [] });
      byProject.get(pid).tasks.push(t);
    }
    return [...byProject.values()];
  }, [tasks]);

  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;

  const handleStatus = (task, status) =>
    updateStatus(task.project?._id, task._id, status);

  const openTask = async (task) => {
    setSelectedTask(task);
    setDrawerOpen(true);
    setDrawerMembers([]);
    if (isManagerRole(task.myRole) && task.project?._id) {
      try {
        const { data } = await projectsApi.listMembers(task.project._id);
        setDrawerMembers(
          (data?.data?.members ?? []).map((m) => ({
            _id: m.user?._id || m._id,
            name: m.user?.fullName || m.user?.username || "Unknown",
          })),
        );
      } catch {
        /* dropdown just limited — non-fatal */
      }
    }
  };

  const handleDrawerUpdate = (taskId, patch) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, ...patch } : t)),
    );
    setSelectedTask((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleDrawerDelete = (taskId) => {
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    setDrawerOpen(false);
    setSelectedTask(null);
  };

  if (loading)
    return (
      <div style={M.center}>
        <span style={M.dim}>LOADING YOUR TASKS…</span>
      </div>
    );

  if (error)
    return (
      <div style={M.center}>
        <span style={{ color: "var(--red)", fontSize: 11, letterSpacing: 1 }}>
          ⚠ {error}
        </span>
        <button onClick={refetch} style={M.retry}>
          ↻ RETRY
        </button>
      </div>
    );

  return (
    <div style={M.page}>
      <div style={M.header}>
        <div>
          <h1 style={M.title}>MY TASKS</h1>
          <span style={M.sub}>TASKS ASSIGNED TO YOU ACROSS ALL PROJECTS</span>
        </div>
        <div style={M.stats}>
          <Stat label="TOTAL" value={total} color="var(--text)" />
          <Stat label="IN PROGRESS" value={inProgress} color="var(--amber)" />
          <Stat label="DONE" value={done} color="var(--phosphor)" />
        </div>
      </div>

      {total === 0 ? (
        <div style={M.center}>
          <span style={M.emptyIcon}>◫</span>
          <span style={M.dim}>NO TASKS ASSIGNED TO YOU</span>
        </div>
      ) : (
        <div style={M.groups}>
          {groups.map((g) => (
            <div key={g.project?._id || "unknown"} style={M.group}>
              <div style={M.groupHeader}>
                <span style={M.groupName}>
                  {g.project?.name?.toUpperCase() || "UNKNOWN PROJECT"}
                </span>
                <span style={M.groupCount}>[{g.tasks.length}]</span>
              </div>
              <div style={M.rows}>
                <AnimatePresence>
                  {g.tasks.map((t) => (
                    <TaskRow
                      key={t._id}
                      task={t}
                      onStatus={handleStatus}
                      onOpen={openTask}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskDetailDrawer
        task={selectedTask}
        projectId={selectedTask?.project?._id}
        members={drawerMembers}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleDrawerUpdate}
        onDelete={handleDrawerDelete}
        canManage={isManagerRole(selectedTask?.myRole)}
      />
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const M = {
  page: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    color: "var(--text)",
    fontFamily: "var(--font-display)",
    fontSize: 22,
    letterSpacing: 4,
    margin: 0,
  },
  sub: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
  },
  stats: { display: "flex", gap: 24 },
  stat: { display: "flex", flexDirection: "column", gap: 3 },
  statValue: { fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1 },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 7,
    letterSpacing: 2,
    color: "var(--muted)",
  },
  groups: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  group: { display: "flex", flexDirection: "column", gap: 8 },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 8,
    borderBottom: "1px solid var(--border)",
  },
  groupName: {
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "bold",
  },
  groupCount: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 1,
  },
  rows: { display: "flex", flexDirection: "column", gap: 6 },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "12px 14px",
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  rowMain: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1,
  },
  rowId: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 1,
    flexShrink: 0,
  },
  rowTitle: {
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  rowRight: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  rowSub: {
    color: "var(--amber)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 1,
  },
  statusSel: { display: "flex", gap: 4 },
  statusBtn: {
    background: "transparent",
    border: "1px solid",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 1,
    padding: "4px 8px",
    cursor: "pointer",
    transition: "all 0.12s",
  },
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 240,
  },
  dim: {
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 2,
  },
  emptyIcon: { fontSize: 30, opacity: 0.3, color: "var(--muted)" },
  retry: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "6px 14px",
    cursor: "pointer",
  },
};
