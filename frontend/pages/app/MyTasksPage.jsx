import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMyTasks } from "../../hooks/index.js";
import { projectsApi } from "../../api/index.js";
import TaskDetailDrawer from "../../components/ui/TaskDetailDrawer.jsx";
import { Button, EmptyState, Skeleton, SectionLabel } from "../../components/ui/primitive.jsx";
import { fadeUp, stagger, EASE } from "../../motion/tokens";

const STATUS = [
  { value: "todo", label: "To do", color: "var(--text-dim)", soft: "var(--surface-2)" },
  { value: "in_progress", label: "In progress", color: "var(--brass)", soft: "var(--brass-soft)" },
  { value: "done", label: "Done", color: "var(--signal)", soft: "var(--signal-soft)" },
];

const isManagerRole = (role) => ["admin", "project_admin"].includes(role);

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
              color: active ? s.color : "var(--text-dim)",
              borderColor: active ? s.color : "var(--border)",
              background: active ? s.soft : "transparent",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function TaskRow({ task, onStatus, onOpen }) {
  const total = task.subTaskStats?.total ?? 0;
  const done = task.subTaskStats?.completed ?? 0;
  return (
    <motion.div
      layout
      variants={fadeUp}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18, ease: EASE }}
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
            {done}/{total}
          </span>
        )}
        <StatusSelector value={task.status} onChange={(s) => onStatus(task, s)} />
      </div>
    </motion.div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={M.stat}>
      <span style={{ ...M.statValue, color }}>{value}</span>
      <span style={M.statLabel}>{label}</span>
    </div>
  );
}

export default function MyTasksPage() {
  const { tasks, loading, error, refetch, updateStatus, setTasks } = useMyTasks();
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMembers, setDrawerMembers] = useState([]);

  const groups = useMemo(() => {
    const byProject = new Map();
    for (const t of tasks) {
      const pid = t.project?._id || "unknown";
      if (!byProject.has(pid)) byProject.set(pid, { project: t.project, tasks: [] });
      byProject.get(pid).tasks.push(t);
    }
    return [...byProject.values()];
  }, [tasks]);

  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;

  const handleStatus = (task, status) => updateStatus(task.project?._id, task._id, status);

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
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, ...patch } : t)));
    setSelectedTask((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  const handleDrawerDelete = (taskId) => {
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    setDrawerOpen(false);
    setSelectedTask(null);
  };

  if (loading) {
    return (
      <div style={M.page}>
        <Skeleton width={200} height={26} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={46} radius="var(--r-md)" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={M.page}>
        <EmptyState
          title="Couldn't load your tasks"
          description={error}
          action={<Button variant="ghost" onClick={refetch}>Try again</Button>}
        />
      </div>
    );
  }

  return (
    <motion.div style={M.page} variants={stagger(0.06)} initial="hidden" animate="show">
      <motion.div variants={fadeUp} style={M.header}>
        <div>
          <h1 style={M.title}>My Tasks</h1>
          <span style={M.sub}>Tasks assigned to you across all projects</span>
        </div>
        <div style={M.stats}>
          <StatPill label="Total" value={total} color="var(--text)" />
          <StatPill label="In progress" value={inProgress} color="var(--brass)" />
          <StatPill label="Done" value={done} color="var(--signal)" />
        </div>
      </motion.div>

      {total === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            title="No tasks assigned to you"
            description="When a teammate assigns you a task, it'll show up here grouped by project."
          />
        </motion.div>
      ) : (
        <div style={M.groups}>
          {groups.map((g) => (
            <motion.div key={g.project?._id || "unknown"} variants={fadeUp}>
              <SectionLabel>{g.project?.name || "Unknown project"} · {g.tasks.length}</SectionLabel>
              <motion.div style={M.rows} variants={stagger(0.04)}>
                <AnimatePresence>
                  {g.tasks.map((t) => (
                    <TaskRow key={t._id} task={t} onStatus={handleStatus} onOpen={openTask} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </motion.div>
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
    </motion.div>
  );
}

const M = {
  page: { display: "flex", flexDirection: "column", gap: 26, minHeight: "100%", maxWidth: 900 },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  title: { fontFamily: "var(--font-display)", fontSize: "1.7rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 },
  sub: { fontSize: "0.86rem", color: "var(--text-dim)", marginTop: 4, display: "block" },
  stats: { display: "flex", gap: 22 },
  stat: { display: "flex", flexDirection: "column", gap: 3 },
  statValue: { fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1 },
  statLabel: { fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" },
  groups: { display: "flex", flexDirection: "column", gap: 24 },
  rows: { display: "flex", flexDirection: "column", gap: 6 },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "11px 14px",
    cursor: "pointer",
    boxShadow: "var(--shadow-sm)",
    transition: "border-color .2s var(--ease)",
  },
  rowMain: { display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 },
  rowId: { color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "0.66rem", flexShrink: 0 },
  rowTitle: { color: "var(--text)", fontSize: "0.86rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
  rowRight: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  rowSub: { color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "0.66rem" },
  statusSel: { display: "flex", gap: 4 },
  statusBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.68rem",
    fontWeight: 500,
    padding: "4px 9px",
    cursor: "pointer",
    transition: "all .15s var(--ease)",
    whiteSpace: "nowrap",
  },
};
