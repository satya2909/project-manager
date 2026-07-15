import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, EmptyState } from "./primitive.jsx";
import { fadeUp, stagger, EASE } from "../../motion/tokens";

const STATUS = {
  todo: { label: "To do", color: "var(--text-dim)", soft: "var(--surface-2)", rank: 0 },
  in_progress: { label: "In progress", color: "var(--brass)", soft: "var(--brass-soft)", rank: 1 },
  done: { label: "Done", color: "var(--signal)", soft: "var(--signal-soft)", rank: 2 },
};

const assigneeName = (t) => {
  const a = t.assignedTo;
  return a?.fullName || a?.username || null;
};

const COLUMNS = [
  { key: "title", label: "Task name", grow: true },
  { key: "project", label: "Project" },
  { key: "taskId", label: "Task ID" },
  { key: "assignee", label: "Assigned to" },
  { key: "status", label: "Status" },
];

const COMPARATORS = {
  title: (t) => t.title?.toLowerCase() || "",
  project: (t) => t.project?.name?.toLowerCase() || "￿",
  taskId: (t) => t._id?.slice(-4).toUpperCase() || "",
  assignee: (t) => assigneeName(t)?.toLowerCase() || "￿",
  status: (t) => STATUS[t.status]?.rank ?? 99,
};

function SortIcon({ direction }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      style={{
        transform: direction === "desc" ? "rotate(180deg)" : "none",
        transition: "transform .15s var(--ease)",
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ─── TaskTable ──────────────────────────────────────────────────────────────────
// Read-oriented table view alongside KanbanBoard. Client-side sort only — the
// backing task lists (GET /tasks/:projectId, /tasks/me, /tasks/org) are all
// small enough that server-side sort/pagination isn't warranted yet.
export default function TaskTable({ tasks = [], showProject = false, onTaskClick, emptyMessage }) {
  const [sortKey, setSortKey] = useState("title");
  const [sortDir, setSortDir] = useState("asc");

  const columns = showProject ? COLUMNS : COLUMNS.filter((c) => c.key !== "project");

  const sorted = useMemo(() => {
    const compare = COMPARATORS[sortKey] ?? COMPARATORS.title;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...tasks].sort((a, b) => {
      const av = compare(a);
      const bv = compare(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [tasks, sortKey, sortDir]);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks"
        description={emptyMessage || "Nothing here yet."}
      />
    );
  }

  return (
    <div style={S.wrap} className="scroll-area">
      <table style={S.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ ...S.th, ...(col.grow ? S.thGrow : {}) }}
                onClick={() => handleSort(col.key)}
              >
                <span style={S.thInner}>
                  {col.label}
                  {sortKey === col.key && <SortIcon direction={sortDir} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody variants={stagger(0.02)} initial="hidden" animate="show">
          <AnimatePresence initial={false}>
            {sorted.map((task) => (
              <motion.tr
                key={task._id}
                layout
                variants={fadeUp}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: EASE }}
                style={S.row}
                onClick={() => onTaskClick?.(task)}
              >
                <td style={{ ...S.td, ...S.tdTitle }}>{task.title}</td>
                {showProject && (
                  <td style={S.td}>{task.project?.name || "—"}</td>
                )}
                <td style={{ ...S.td, ...S.tdMono }}>
                  #{task._id?.slice(-4).toUpperCase()}
                </td>
                <td style={S.td}>
                  <div style={S.assignee}>
                    {assigneeName(task) ? (
                      <>
                        <Avatar name={assigneeName(task)} size={20} />
                        <span style={S.assigneeName}>{assigneeName(task)}</span>
                      </>
                    ) : (
                      <span style={S.unassigned}>Unassigned</span>
                    )}
                  </div>
                </td>
                <td style={S.td}>
                  {(() => {
                    const s = STATUS[task.status] || STATUS.todo;
                    return (
                      <span style={{ ...S.statusBadge, color: s.color, background: s.soft }}>
                        {s.label}
                      </span>
                    );
                  })()}
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </motion.tbody>
      </table>
    </div>
  );
}

const S = {
  wrap: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    overflow: "auto",
    background: "var(--surface)",
    boxShadow: "var(--shadow-sm)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  thGrow: { width: "40%" },
  thInner: { display: "inline-flex", alignItems: "center", gap: 5 },
  row: {
    cursor: "pointer",
    borderBottom: "1px solid var(--border)",
    transition: "background .15s var(--ease)",
  },
  td: { padding: "10px 14px", color: "var(--text)", verticalAlign: "middle" },
  tdTitle: { fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 },
  tdMono: { fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-dim)" },
  assignee: { display: "flex", alignItems: "center", gap: 8 },
  assigneeName: { fontSize: "0.8rem", color: "var(--text)" },
  unassigned: { fontSize: "0.78rem", color: "var(--text-dim)", fontStyle: "italic" },
  statusBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.66rem",
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: "var(--r-sm)",
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },
};
