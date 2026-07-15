import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskHub } from "../../hooks/index.js";
import { useAuth } from "../../context/authcontext.jsx";
import { projectsApi } from "../../api/index.js";
import TaskDetailDrawer from "../../components/ui/TaskDetailDrawer.jsx";
import TaskTable from "../../components/ui/TaskTable.jsx";
import { Button, EmptyState, Skeleton, SectionLabel } from "../../components/ui/primitive.jsx";
import { fadeUp, stagger, EASE } from "../../motion/tokens";

const STATUS = [
  { value: "todo", label: "To do", color: "var(--text-dim)", soft: "var(--surface-2)" },
  { value: "in_progress", label: "In progress", color: "var(--brass)", soft: "var(--brass-soft)" },
  { value: "done", label: "Done", color: "var(--signal)", soft: "var(--signal-soft)" },
];
const STATUS_LABEL = Object.fromEntries(STATUS.map((s) => [s.value, s.label]));

const isManagerRole = (role) => ["admin", "project_admin"].includes(role);

// ── view preference (localStorage, mirrors ProjectPage's per-project pattern) ──
const HUB_VIEW_KEY = "taskView:hub";

function getStoredHubView() {
  try {
    return localStorage.getItem(HUB_VIEW_KEY) || "list";
  } catch {
    return "list";
  }
}

function setStoredHubView(view) {
  try {
    localStorage.setItem(HUB_VIEW_KEY, view);
  } catch {
    /* storage unavailable — view choice just won't persist, non-fatal */
  }
}

// ── CSV export (Table view only) ────────────────────────────────────────────
function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function exportTasksToCsv(tasks) {
  if (tasks.length === 0) return;
  const headers = ["Task Name", "Project", "Task ID", "Assigned To", "Status"];
  const rows = tasks.map((t) => [
    t.title,
    t.project?.name || "",
    `#${t._id?.slice(-4).toUpperCase()}`,
    t.assignee?.name || "Unassigned",
    STATUS_LABEL[t.status] || t.status,
  ]);
  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ViewToggle({ view, onChange }) {
  const OPTIONS = [
    { value: "list", label: "List" },
    { value: "table", label: "Table" },
  ];
  return (
    <div style={M.viewToggle}>
      {OPTIONS.map((o) => {
        const active = view === o.value;
        return (
          <button
            key={o.value}
            onClick={() => !active && onChange(o.value)}
            style={{
              ...M.viewToggleBtn,
              color: active ? "var(--text)" : "var(--text-dim)",
              background: active ? "var(--surface-2)" : "transparent",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterBar({ filters, onChange, projectOptions, assigneeOptions }) {
  return (
    <div style={M.filterBar}>
      <select
        className="input-field"
        style={M.filterSelect}
        value={filters.project}
        onChange={(e) => onChange({ ...filters, project: e.target.value })}
      >
        <option value="all">All projects</option>
        {projectOptions.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select
        className="input-field"
        style={M.filterSelect}
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="all">All statuses</option>
        {STATUS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <select
        className="input-field"
        style={M.filterSelect}
        value={filters.assignee}
        onChange={(e) => onChange({ ...filters, assignee: e.target.value })}
      >
        <option value="all">All assignees</option>
        {assigneeOptions.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  );
}

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
  const { isOrgManager } = useAuth();
  const { tasks, loading, error, refetch, updateStatus, setTasks } = useTaskHub(isOrgManager);
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMembers, setDrawerMembers] = useState([]);
  const [view, setView] = useState(getStoredHubView);
  const [filters, setFilters] = useState({ project: "all", status: "all", assignee: "all" });

  const handleViewChange = (next) => {
    setView(next);
    setStoredHubView(next);
  };

  const projectOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => t.project?._id && map.set(t.project._id, t.project.name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const assigneeOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => t.assignee?._id && map.set(t.assignee._id, t.assignee.name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.project !== "all" && t.project?._id !== filters.project) return false;
      if (filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.assignee !== "all" && t.assignee?._id !== filters.assignee) return false;
      return true;
    });
  }, [tasks, filters]);

  const groups = useMemo(() => {
    const byProject = new Map();
    for (const t of filteredTasks) {
      const pid = t.project?._id || "unknown";
      if (!byProject.has(pid)) byProject.set(pid, { project: t.project, tasks: [] });
      byProject.get(pid).tasks.push(t);
    }
    return [...byProject.values()];
  }, [filteredTasks]);

  const total = filteredTasks.length;
  const inProgress = filteredTasks.filter((t) => t.status === "in_progress").length;
  const done = filteredTasks.filter((t) => t.status === "done").length;

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
          title="Couldn't load tasks"
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
          <h1 style={M.title}>{isOrgManager ? "All Tasks" : "My Tasks"}</h1>
          <span style={M.sub}>
            {isOrgManager
              ? "Every task across your organization's projects"
              : "Tasks assigned to you across all projects"}
          </span>
        </div>
        <div style={M.stats}>
          <StatPill label="Total" value={total} color="var(--text)" />
          <StatPill label="In progress" value={inProgress} color="var(--brass)" />
          <StatPill label="Done" value={done} color="var(--signal)" />
        </div>
      </motion.div>

      {tasks.length > 0 && (
        <motion.div variants={fadeUp} style={M.toolbar}>
          <FilterBar
            filters={filters}
            onChange={setFilters}
            projectOptions={projectOptions}
            assigneeOptions={assigneeOptions}
          />
          <div style={M.toolbarRight}>
            {view === "table" && (
              <Button variant="ghost" onClick={() => exportTasksToCsv(filteredTasks)}>
                Export CSV
              </Button>
            )}
            <ViewToggle view={view} onChange={handleViewChange} />
          </div>
        </motion.div>
      )}

      {tasks.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            title={isOrgManager ? "No tasks in your organization yet" : "No tasks assigned to you"}
            description={
              isOrgManager
                ? "Once projects have tasks, they'll show up here."
                : "When a teammate assigns you a task, it'll show up here grouped by project."
            }
          />
        </motion.div>
      ) : filteredTasks.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            title="No tasks match these filters"
            description="Try clearing a filter to see more tasks."
          />
        </motion.div>
      ) : view === "table" ? (
        <motion.div variants={fadeUp}>
          <TaskTable tasks={filteredTasks} showProject onTaskClick={openTask} />
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
  page: { display: "flex", flexDirection: "column", gap: 26, minHeight: "100%", maxWidth: 1000 },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  title: { fontFamily: "var(--font-display)", fontSize: "1.7rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 },
  sub: { fontSize: "0.86rem", color: "var(--text-dim)", marginTop: 4, display: "block" },
  stats: { display: "flex", gap: 22 },
  stat: { display: "flex", flexDirection: "column", gap: 3 },
  statValue: { fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1 },
  statLabel: { fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)" },

  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  toolbarRight: { display: "flex", alignItems: "center", gap: 8 },
  filterBar: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterSelect: { width: "auto", minWidth: 130, padding: "0.4rem 0.6rem", fontSize: "0.78rem" },
  viewToggle: { display: "flex", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 2 },
  viewToggleBtn: {
    border: "none",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.78rem",
    fontWeight: 500,
    padding: "5px 12px",
    cursor: "pointer",
    transition: "all .15s var(--ease)",
  },

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
