import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import taskService from "../../services/task.service.js";

const STATUS_OPTIONS = [
  { value: "todo", label: "TODO", color: "var(--muted)" },
  { value: "in_progress", label: "IN PROGRESS", color: "var(--amber)" },
  { value: "done", label: "DONE", color: "var(--phosphor)" },
];
const PRIORITY_OPTIONS = [
  { value: "high", label: "▲▲ HIGH", color: "var(--red)" },
  { value: "medium", label: "▲  MEDIUM", color: "var(--amber)" },
  { value: "low", label: "▼  LOW", color: "var(--muted)" },
];

// ── inline editable field ─────────────────────────────────────────────────────
function EditableField({ label, value, multiline, onChange, muted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft.trim());
  };

  if (editing) {
    const Tag = multiline ? "textarea" : "input";
    return (
      <div style={D.fieldWrap}>
        <span style={D.fieldLabel}>{label}</span>
        <Tag
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (!multiline && e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          rows={multiline ? 4 : undefined}
          style={{ ...D.editInput, ...(multiline ? D.editTextarea : {}) }}
        />
      </div>
    );
  }

  return (
    <div style={D.fieldWrap}>
      <span style={D.fieldLabel}>{label}</span>
      <button
        onClick={() => setEditing(true)}
        style={{
          ...D.fieldValue,
          color: muted ? "var(--muted)" : "var(--text)",
        }}
      >
        {value || (
          <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
            CLICK TO EDIT
          </span>
        )}
        <span style={D.editIcon}>✎</span>
      </button>
    </div>
  );
}

// ── subtask row ───────────────────────────────────────────────────────────────
function SubtaskRow({ subtask, projectId, onToggle, onDelete, canManage }) {
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      await taskService.updateSubtask(projectId, subtask._id, {
        isCompleted: !subtask.isCompleted,
      });
      onToggle(subtask._id, !subtask.isCompleted);
    } catch (e) {
      console.error("Subtask toggle failed", e);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    try {
      await taskService.deleteSubtask(projectId, subtask._id);
      onDelete(subtask._id);
    } catch (e) {
      console.error("Subtask delete failed", e);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        ...D.subtaskRow,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <button onClick={toggle} style={D.subtaskCheck} disabled={loading}>
        <span
          style={{
            ...D.checkBox,
            borderColor: subtask.isCompleted
              ? "var(--phosphor)"
              : "var(--border)",
            background: subtask.isCompleted
              ? "rgba(0,255,65,0.12)"
              : "transparent",
            color: subtask.isCompleted ? "var(--phosphor)" : "transparent",
          }}
        >
          {subtask.isCompleted ? "✓" : ""}
        </span>
      </button>
      <span
        style={{
          ...D.subtaskTitle,
          color: subtask.isCompleted ? "var(--muted)" : "var(--text)",
          textDecoration: subtask.isCompleted ? "line-through" : "none",
        }}
      >
        {subtask.title}
      </span>
      {canManage && (
        <button onClick={remove} style={D.subtaskDel} title="Delete subtask">
          ✕
        </button>
      )}
    </motion.div>
  );
}

// ── add subtask inline input ──────────────────────────────────────────────────
function AddSubtaskInput({ projectId, taskId, onAdded }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 60);
  }, [active]);

  const commit = async () => {
    const title = value.trim();
    if (!title) {
      setActive(false);
      setValue("");
      return;
    }
    setLoading(true);
    try {
      const newSt = await taskService.createSubtask(projectId, taskId, {
        title,
      });
      onAdded(newSt);
      setValue("");
      // keep input open for rapid multi-add
      setTimeout(() => inputRef.current?.focus(), 40);
    } catch (e) {
      console.error("Add subtask failed", e);
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setValue("");
    setActive(false);
  };

  if (!active) {
    return (
      <button onClick={() => setActive(true)} style={D.addSubtaskTrigger}>
        <span style={D.addSubtaskPlus}>+</span>
        ADD SUBTASK
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={D.addSubtaskRow}
    >
      <span
        style={{
          ...D.checkBox,
          borderColor: "var(--border)",
          color: "transparent",
          flexShrink: 0,
        }}
      >
        {" "}
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder="SUBTASK TITLE..."
        disabled={loading}
        style={D.addSubtaskInput}
        maxLength={120}
      />
      <button
        onClick={commit}
        disabled={loading || !value.trim()}
        style={{
          ...D.addSubtaskConfirm,
          opacity: value.trim() && !loading ? 1 : 0.35,
        }}
        title="Add (Enter)"
      >
        {loading ? "◌" : "✓"}
      </button>
      <button onClick={cancel} style={D.subtaskDel} title="Cancel (Escape)">
        ✕
      </button>
    </motion.div>
  );
}

// ── main drawer ───────────────────────────────────────────────────────────────
export default function TaskDetailDrawer({
  task,
  projectId,
  members = [],
  isOpen,
  onClose,
  onUpdate, // (taskId, patch) — optimistic update callback
  onDelete, // (taskId)
  canManage = false, // Admin / Project Admin
}) {
  const [localTask, setLocalTask] = useState(task);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // Sync if parent passes updated task. Also clear the post-delete slide-out
  // flag so a newly selected task animates back into view (otherwise the panel
  // stays parked off-screen and details only appear after a manual refresh).
  useEffect(() => {
    if (task) {
      setLocalTask(task);
      setDeleted(false);
    }
  }, [task]);

  // Close on Escape
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  if (!localTask) return null;

  const patch = async (field, value) => {
    const update = { [field]: value };
    // Optimistic UI
    setLocalTask((t) => ({ ...t, ...update }));
    onUpdate?.(localTask._id, update);
    setSaving(true);
    try {
      await taskService.updateTask(projectId, localTask._id, update);
    } catch (e) {
      console.error("Task update failed", e);
      // Rollback
      setLocalTask(task);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm("DELETE THIS TASK? THIS CANNOT BE UNDONE.")) return;
    try {
      await taskService.deleteTask(projectId, localTask._id);
      setDeleted(true);
      onDelete?.(localTask._id);
      setTimeout(onClose, 400);
    } catch (e) {
      console.error("Task delete failed", e);
    }
  };

  const handleSubtaskToggle = (subId, isCompleted) => {
    setLocalTask((t) => ({
      ...t,
      subTasks: t.subTasks.map((s) =>
        s._id === subId ? { ...s, isCompleted } : s,
      ),
    }));
  };

  const handleSubtaskDelete = (subId) => {
    setLocalTask((t) => ({
      ...t,
      subTasks: t.subTasks.filter((s) => s._id !== subId),
    }));
  };

  const handleSubtaskAdd = (newSubtask) => {
    setLocalTask((t) => ({
      ...t,
      subTasks: [...(t.subTasks || []), newSubtask],
    }));
  };

  const statusCfg =
    STATUS_OPTIONS.find((s) => s.value === localTask.status) ||
    STATUS_OPTIONS[0];
  const priorityCfg =
    PRIORITY_OPTIONS.find((p) => p.value === localTask.priority) ||
    PRIORITY_OPTIONS[1];
  const doneCount =
    localTask.subTasks?.filter((s) => s.isCompleted).length || 0;
  const totalCount = localTask.subTasks?.length || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={D.backdrop}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: deleted ? "100%" : 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={D.drawer}
          >
            {/* Top accent bar — color matches status */}
            <div style={{ ...D.accentBar, background: statusCfg.color }} />

            {/* Header */}
            <div style={D.header}>
              <div style={D.headerMeta}>
                <span style={{ ...D.taskId, color: statusCfg.color }}>
                  #{localTask._id?.slice(-6).toUpperCase()}
                </span>
                {saving && <span style={D.savingBadge}>◌ SAVING</span>}
              </div>
              <div style={D.headerActions}>
                {canManage && (
                  <button
                    onClick={handleDeleteTask}
                    style={D.deleteBtn}
                    title="Delete task"
                  >
                    ⌫ DELETE
                  </button>
                )}
                <button onClick={onClose} style={D.closeBtn}>
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div style={D.content}>
              {/* Title */}
              {canManage ? (
                <EditableField
                  label="TASK TITLE"
                  value={localTask.title}
                  onChange={(v) => patch("title", v)}
                />
              ) : (
                <div style={D.fieldWrap}>
                  <span style={D.fieldLabel}>TASK TITLE</span>
                  <span style={{ ...D.fieldValue, cursor: "default" }}>
                    {localTask.title}
                  </span>
                </div>
              )}

              {/* Description */}
              {canManage ? (
                <EditableField
                  label="DESCRIPTION"
                  value={localTask.description || ""}
                  multiline
                  muted
                  onChange={(v) => patch("description", v)}
                />
              ) : localTask.description ? (
                <div style={D.fieldWrap}>
                  <span style={D.fieldLabel}>DESCRIPTION</span>
                  <p
                    style={{
                      ...D.fieldValue,
                      color: "var(--muted)",
                      cursor: "default",
                      lineHeight: 1.6,
                    }}
                  >
                    {localTask.description}
                  </p>
                </div>
              ) : null}

              <div style={D.divider} />

              {/* Status + Priority */}
              <div style={D.row2}>
                <div style={D.fieldWrap}>
                  <span style={D.fieldLabel}>STATUS</span>
                  {canManage ? (
                    <div style={D.segWrap}>
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => patch("status", opt.value)}
                          style={{
                            ...D.segBtn,
                            borderColor:
                              localTask.status === opt.value
                                ? opt.color
                                : "var(--border)",
                            color:
                              localTask.status === opt.value
                                ? opt.color
                                : "var(--muted)",
                            background:
                              localTask.status === opt.value
                                ? `${opt.color}12`
                                : "transparent",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span
                      style={{
                        ...D.chip,
                        color: statusCfg.color,
                        borderColor: statusCfg.color,
                      }}
                    >
                      {statusCfg.label}
                    </span>
                  )}
                </div>

                <div style={D.fieldWrap}>
                  <span style={D.fieldLabel}>PRIORITY</span>
                  {canManage ? (
                    <div style={D.segWrap}>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => patch("priority", opt.value)}
                          style={{
                            ...D.segBtn,
                            borderColor:
                              localTask.priority === opt.value
                                ? opt.color
                                : "var(--border)",
                            color:
                              localTask.priority === opt.value
                                ? opt.color
                                : "var(--muted)",
                            background:
                              localTask.priority === opt.value
                                ? `${opt.color}12`
                                : "transparent",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span
                      style={{
                        ...D.chip,
                        color: priorityCfg.color,
                        borderColor: priorityCfg.color,
                      }}
                    >
                      {priorityCfg.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Assignee */}
              {(localTask.assignee || canManage) && (
                <div style={D.fieldWrap}>
                  <span style={D.fieldLabel}>ASSIGNED TO</span>
                  {canManage ? (
                    <select
                      value={localTask.assignee?._id || ""}
                      onChange={(e) => patch("assigneeId", e.target.value)}
                      style={D.select}
                    >
                      <option value="">— UNASSIGNED —</option>
                      {members.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name?.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  ) : localTask.assignee ? (
                    <div style={D.assigneeChip}>
                      <span style={D.assigneeAvatar}>
                        {localTask.assignee.name?.[0]?.toUpperCase() || "?"}
                      </span>
                      <span style={D.assigneeName}>
                        {localTask.assignee.name?.toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>
                      UNASSIGNED
                    </span>
                  )}
                </div>
              )}

              <div style={D.divider} />

              {/* Subtasks */}
              <div style={D.fieldWrap}>
                <div style={D.subtaskHeader}>
                  <span style={D.fieldLabel}>SUBTASKS</span>
                  <span style={D.subtaskProgress}>
                    {doneCount}/{totalCount} COMPLETE
                  </span>
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div style={D.progTrack}>
                    <motion.div
                      animate={{ width: `${(doneCount / totalCount) * 100}%` }}
                      transition={{ duration: 0.3 }}
                      style={{
                        ...D.progFill,
                        background:
                          doneCount === totalCount
                            ? "var(--phosphor)"
                            : "var(--amber)",
                        boxShadow:
                          doneCount === totalCount
                            ? "0 0 6px var(--phosphor)"
                            : "none",
                      }}
                    />
                  </div>
                )}

                <AnimatePresence>
                  {localTask.subTasks?.map((st) => (
                    <SubtaskRow
                      key={st._id}
                      subtask={st}
                      projectId={projectId}
                      onToggle={handleSubtaskToggle}
                      onDelete={handleSubtaskDelete}
                      canManage={canManage}
                    />
                  ))}
                </AnimatePresence>

                {totalCount === 0 && !canManage && (
                  <span
                    style={{
                      color: "var(--muted)",
                      fontSize: 9,
                      letterSpacing: 1,
                    }}
                  >
                    NO SUBTASKS
                  </span>
                )}

                {canManage && (
                  <AddSubtaskInput
                    projectId={projectId}
                    taskId={localTask._id}
                    onAdded={handleSubtaskAdd}
                  />
                )}
              </div>

              {/* Attachments */}
              {localTask.attachments?.length > 0 && (
                <>
                  <div style={D.divider} />
                  <div style={D.fieldWrap}>
                    <span style={D.fieldLabel}>
                      ATTACHMENTS [{localTask.attachments.length}]
                    </span>
                    <div style={D.attachList}>
                      {localTask.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          style={D.attachItem}
                        >
                          <span style={D.attachIcon}>◈</span>
                          <span style={D.attachName}>
                            {att.url?.split("/").pop() || `FILE-${i + 1}`}
                          </span>
                          <span style={D.attachSize}>
                            {att.size ? `${Math.round(att.size / 1024)}KB` : ""}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const D = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 1100,
  },
  drawer: {
    position: "fixed",
    top: 0,
    right: 0,
    width: 420,
    height: "100vh",
    background: "var(--surface)",
    borderLeft: "1px solid var(--border)",
    zIndex: 1101,
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--font-mono)",
    boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
  },
  accentBar: { height: 3, flexShrink: 0 },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  headerMeta: { display: "flex", alignItems: "center", gap: 12 },
  taskId: { fontSize: 10, letterSpacing: 3, fontWeight: "bold" },
  savingBadge: {
    fontSize: 8,
    letterSpacing: 2,
    color: "var(--amber)",
    animation: "pulse 1s ease-in-out infinite",
  },
  headerActions: { display: "flex", alignItems: "center", gap: 8 },
  deleteBtn: {
    background: "rgba(255,60,60,0.06)",
    border: "1px solid var(--red)",
    color: "var(--red)",
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 2,
    padding: "5px 10px",
    cursor: "pointer",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 14,
    padding: 4,
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  divider: { height: 1, background: "var(--border)", margin: "4px 0" },

  // Fields
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 8, letterSpacing: 2, color: "var(--muted)" },
  fieldValue: {
    background: "none",
    border: "none",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: 0.5,
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    lineHeight: 1.5,
    width: "100%",
  },
  editIcon: {
    color: "var(--muted)",
    fontSize: 10,
    opacity: 0,
    marginLeft: "auto",
    flexShrink: 0,
  },
  editInput: {
    background: "var(--bg)",
    border: "1px solid var(--phosphor-dim)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: 0.5,
    padding: "8px 10px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  editTextarea: { resize: "vertical", minHeight: 72, lineHeight: 1.6 },

  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },

  segWrap: { display: "flex", flexDirection: "column", gap: 3 },
  segBtn: {
    background: "transparent",
    border: "1px solid",
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 1,
    padding: "5px 8px",
    cursor: "pointer",
    transition: "all 0.12s",
    textAlign: "left",
  },
  chip: {
    display: "inline-block",
    border: "1px solid",
    fontSize: 8,
    letterSpacing: 2,
    padding: "3px 8px",
    fontFamily: "var(--font-mono)",
  },

  select: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 1,
    padding: "8px 10px",
    outline: "none",
    cursor: "pointer",
    width: "100%",
  },
  assigneeChip: { display: "flex", alignItems: "center", gap: 8 },
  assigneeAvatar: {
    width: 24,
    height: 24,
    background: "rgba(0,255,65,0.1)",
    border: "1px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontSize: 10,
    fontWeight: "bold",
  },
  assigneeName: { color: "var(--text)", fontSize: 10, letterSpacing: 2 },

  // Subtasks
  subtaskHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subtaskProgress: { fontSize: 8, color: "var(--amber)", letterSpacing: 2 },
  progTrack: {
    height: 2,
    background: "var(--border)",
    overflow: "hidden",
    marginBottom: 10,
  },
  progFill: { height: "100%" },
  subtaskRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
  },
  subtaskCheck: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    display: "flex",
  },
  checkBox: {
    width: 14,
    height: 14,
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8,
    fontWeight: "bold",
    transition: "all 0.15s",
    fontFamily: "var(--font-mono)",
  },
  subtaskTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 0.5,
    flex: 1,
    transition: "color 0.15s",
  },
  subtaskDel: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 9,
    padding: 2,
    opacity: 0.6,
    flexShrink: 0,
  },

  // Add subtask
  addSubtaskTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "none",
    border: "1px dashed var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "6px 10px",
    cursor: "pointer",
    marginTop: 6,
    width: "100%",
    transition: "border-color 0.15s, color 0.15s",
  },
  addSubtaskPlus: {
    color: "var(--phosphor)",
    fontSize: 12,
    lineHeight: 1,
    flexShrink: 0,
  },
  addSubtaskRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    padding: "4px 0",
  },
  addSubtaskInput: {
    flex: 1,
    background: "var(--bg)",
    border: "1px solid var(--phosphor-dim)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 0.5,
    padding: "5px 8px",
    outline: "none",
    boxSizing: "border-box",
  },
  addSubtaskConfirm: {
    background: "none",
    border: "none",
    color: "var(--phosphor)",
    cursor: "pointer",
    fontSize: 11,
    padding: 2,
    flexShrink: 0,
    fontFamily: "var(--font-mono)",
    transition: "opacity 0.15s",
  },

  // Attachments
  attachList: { display: "flex", flexDirection: "column", gap: 4 },
  attachItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    padding: "7px 10px",
    textDecoration: "none",
    transition: "border-color 0.15s",
  },
  attachIcon: { color: "var(--phosphor-dim)", fontSize: 10, flexShrink: 0 },
  attachName: {
    color: "var(--text)",
    fontSize: 9,
    letterSpacing: 1,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  attachSize: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: 1,
    flexShrink: 0,
  },
};
