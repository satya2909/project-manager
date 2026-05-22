import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";

const STATUS_CONFIG = {
  todo: { color: "var(--muted)", label: "TODO", pulse: false },
  in_progress: { color: "var(--amber)", label: "IN PROGRESS", pulse: true },
  done: { color: "var(--phosphor)", label: "DONE", pulse: false },
};

const PRIORITY_CONFIG = {
  high: { color: "var(--red)", symbol: "▲▲" },
  medium: { color: "var(--amber)", symbol: "▲" },
  low: { color: "var(--muted)", symbol: "▼" },
};

export default function TaskCard({ task, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  const assigneeInitial = task.assignee?.name
    ? task.assignee.name[0].toUpperCase()
    : "?";

  const subtasksDone = task.subTasks?.filter((s) => s.isCompleted)?.length || 0;
  const subtasksTotal = task.subTasks?.length || 0;
  const subtaskProgress = subtasksTotal > 0 ? subtasksDone / subtasksTotal : 0;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <motion.div
        animate={{
          rotate: isDragging ? 2 : 0,
          scale: isDragging ? 1.04 : 1,
          boxShadow: isDragging
            ? "0 16px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,255,65,0.2)"
            : "0 2px 8px rgba(0,0,0,0.3)",
          zIndex: isDragging ? 50 : 1,
        }}
        transition={{ duration: 0.15 }}
        onClick={!isDragging ? onClick : undefined}
        style={{
          ...cardStyles.card,
          opacity: isDragging ? 0.95 : 1,
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        {/* Status pulse bar top */}
        <div style={{ ...cardStyles.statusBar, background: statusCfg.color }}>
          {statusCfg.pulse && <div style={cardStyles.pulseOverlay} />}
        </div>

        {/* Header row */}
        <div style={cardStyles.header}>
          <span style={{ ...cardStyles.priority, color: priorityCfg.color }}>
            {priorityCfg.symbol}
          </span>
          <span style={cardStyles.taskId}>
            #{task._id?.slice(-4).toUpperCase() || "????"}
          </span>
        </div>

        {/* Title */}
        <h4 style={cardStyles.title}>{task.title}</h4>

        {/* Description truncated */}
        {task.description && <p style={cardStyles.desc}>{task.description}</p>}

        {/* Subtask progress */}
        {subtasksTotal > 0 && (
          <div style={cardStyles.progressWrap}>
            <div style={cardStyles.progressBar}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${subtaskProgress * 100}%` }}
                transition={{ duration: 0.4 }}
                style={{
                  ...cardStyles.progressFill,
                  background:
                    subtaskProgress === 1 ? "var(--phosphor)" : "var(--amber)",
                  boxShadow:
                    subtaskProgress === 1 ? "0 0 4px var(--phosphor)" : "none",
                }}
              />
            </div>
            <span style={cardStyles.progressLabel}>
              {subtasksDone}/{subtasksTotal} SUBTASKS
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={cardStyles.footer}>
          {/* Assignee */}
          <div style={cardStyles.assignee} title={task.assignee?.name}>
            <span style={cardStyles.assigneeAvatar}>{assigneeInitial}</span>
            {task.assignee?.name && (
              <span style={cardStyles.assigneeName}>
                {task.assignee.name.split(" ")[0].toUpperCase()}
              </span>
            )}
          </div>

          {/* Attachments count */}
          {task.attachments?.length > 0 && (
            <span style={cardStyles.badge}>◈ {task.attachments.length}</span>
          )}

          {/* Status chip */}
          <span
            style={{
              ...cardStyles.statusChip,
              color: statusCfg.color,
              borderColor: statusCfg.color,
            }}
          >
            {statusCfg.label}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

const cardStyles = {
  card: {
    background: "var(--surface-raised)",
    border: "1px solid var(--border)",
    padding: "0 0 12px",
    marginBottom: 8,
    position: "relative",
    overflow: "hidden",
    transition: "border-color 0.15s",
  },
  statusBar: {
    height: 3,
    width: "100%",
    position: "relative",
    overflow: "hidden",
    marginBottom: 12,
  },
  pulseOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
    animation: "shimmer 1.5s ease-in-out infinite",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 12px",
    marginBottom: 8,
  },
  priority: {
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: "var(--font-mono)",
  },
  taskId: {
    color: "var(--muted)",
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: "var(--font-mono)",
  },
  title: {
    color: "var(--text)",
    fontSize: 12,
    letterSpacing: 0.5,
    lineHeight: 1.4,
    padding: "0 12px",
    margin: "0 0 6px",
    fontFamily: "var(--font-mono)",
    fontWeight: "bold",
  },
  desc: {
    color: "var(--muted)",
    fontSize: 10,
    lineHeight: 1.5,
    padding: "0 12px",
    margin: "0 0 10px",
    fontFamily: "var(--font-mono)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  progressWrap: {
    padding: "0 12px",
    marginBottom: 10,
  },
  progressBar: {
    height: 2,
    background: "var(--border)",
    marginBottom: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
  progressLabel: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: 2,
    fontFamily: "var(--font-mono)",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  },
  assignee: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  assigneeAvatar: {
    width: 18,
    height: 18,
    background: "rgba(0,255,65,0.12)",
    border: "1px solid rgba(0,255,65,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontSize: 8,
    fontWeight: "bold",
    fontFamily: "var(--font-mono)",
    lineHeight: "18px",
    textAlign: "center",
  },
  assigneeName: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: 1,
    fontFamily: "var(--font-mono)",
  },
  badge: {
    color: "var(--muted)",
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: "var(--font-mono)",
  },
  statusChip: {
    fontSize: 8,
    letterSpacing: 1.5,
    fontFamily: "var(--font-mono)",
    border: "1px solid",
    padding: "2px 6px",
  },
};
