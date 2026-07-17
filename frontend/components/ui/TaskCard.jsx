import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { useAuth } from "../../context/authcontext.jsx";
import { EASE, EASE_OUT } from "../../motion/tokens";
import { DueDateBadge, TaskKeyBadge } from "./primitive.jsx";

const PRIORITY = {
  high: { label: "HIGH", color: "var(--danger)", soft: "var(--danger-soft)" },
  medium: { label: "MED", color: "var(--brass)", soft: "var(--brass-soft)" },
  low: { label: "LOW", color: "var(--text-dim)", soft: "var(--surface-2)" },
};

export default function TaskCard({ task, onClick, onToggleComplete, overlay = false }) {
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  // Assignee arrives in two shapes: MyTasksPage normalizes to task.assignee;
  // the Kanban board leaves the raw populated task.assignedTo. Support both.
  const assignee = task.assignee ?? task.assignedTo ?? null;
  const assigneeName =
    assignee?.name || assignee?.fullName || assignee?.username || null;
  const isMine = !!assignee?._id && !!user?._id && assignee._id === user._id;

  const done = task.status === "done";
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  const subDone = task.subTasks?.filter((s) => s.isCompleted)?.length || 0;
  const subTotal = task.subTasks?.length || 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const restShadow = isMine
    ? "inset 3px 0 0 var(--signal), var(--shadow-sm)"
    : "var(--shadow-sm)";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginBottom: 8 }}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
    >
      <motion.div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={!isDragging ? onClick : undefined}
        animate={{
          rotate: isDragging ? 2 : 0,
          scale: isDragging ? 1.04 : 1,
          boxShadow: isDragging ? "var(--shadow-lg)" : restShadow,
          y: hovered && !isDragging ? -2 : 0,
          zIndex: isDragging ? 50 : 1,
        }}
        transition={{ duration: 0.2, ease: EASE }}
        style={{
          ...S.card,
          borderColor: hovered || isDragging ? "var(--border-hi)" : "var(--border)",
          background: hovered && !isDragging ? "var(--panel-hi)" : "var(--panel)",
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        <div style={S.top}>
          {/* Quick-complete checkbox — spring morph + tick draw */}
          <button
            type="button"
            aria-label={done ? "Mark as not done" : "Mark as done"}
            aria-pressed={done}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete?.(task);
            }}
            style={S.chkBtn}
          >
            <motion.span
              animate={{ scale: done ? 1.05 : 1 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              style={{
                ...S.chk,
                background: done ? "var(--signal)" : "transparent",
                borderColor: done ? "var(--signal)" : "var(--border-hi)",
              }}
            >
              <motion.svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--signal-ink)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <motion.path
                  d="M20 6L9 17l-5-5"
                  initial={false}
                  animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                />
              </motion.svg>
            </motion.span>
          </button>

          <div style={{ ...S.title, color: done ? "var(--text-dim)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>
            {task.title}
          </div>
        </div>

        <div style={S.foot}>
          <TaskKeyBadge taskKey={task.taskKey} />
          <span style={{ ...S.tag, background: priority.soft, color: priority.color }}>
            {priority.label}
          </span>
          <DueDateBadge task={task} />
          {subTotal > 0 && (
            <span style={S.subCount}>
              {subDone}/{subTotal}
            </span>
          )}
          <span
            style={{
              ...S.avatar,
              ...(isMine
                ? { background: "var(--signal)", color: "var(--signal-ink)" }
                : {}),
            }}
            title={assigneeName || "Unassigned"}
          >
            {assigneeName ? assigneeName[0].toUpperCase() : "?"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

const S = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "12px 12px 11px",
    position: "relative",
    transition: "border-color .25s var(--ease), background .25s var(--ease)",
  },
  top: { display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  chkBtn: {
    background: "none",
    border: "none",
    padding: 0,
    margin: "1px 0 0",
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
  },
  chk: {
    width: 15,
    height: 15,
    borderRadius: 4,
    border: "1.5px solid var(--border-hi)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: "0.83rem",
    lineHeight: 1.4,
    fontFamily: "var(--font-sans)",
  },
  foot: { display: "flex", alignItems: "center", gap: 8, marginLeft: 23 },
  tag: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    padding: "2px 6px",
    borderRadius: "var(--r-sm)",
    letterSpacing: "0.03em",
  },
  subCount: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    color: "var(--text-dim)",
  },
  avatar: {
    marginLeft: "auto",
    width: 19,
    height: 19,
    borderRadius: "50%",
    background: "var(--panel-hi)",
    color: "var(--text-soft)",
    border: "1px solid var(--border-hi)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: "0.56rem",
    fontWeight: 600,
    flexShrink: 0,
  },
};
