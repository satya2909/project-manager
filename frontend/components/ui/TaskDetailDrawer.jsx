import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "./Modal.jsx";
import { Button, Label, TaskKeyBadge } from "./primitive.jsx";
import { EASE, EASE_OUT } from "../../motion/tokens";
import taskService from "../../services/task.service.js";

const STATUS_OPTIONS = [
  { value: "todo", label: "To do", color: "var(--text-dim)", soft: "var(--surface-2)" },
  { value: "in_progress", label: "In progress", color: "var(--brass)", soft: "var(--brass-soft)" },
  { value: "done", label: "Done", color: "var(--signal)", soft: "var(--signal-soft)" },
];
const PRIORITY_OPTIONS = [
  { value: "high", label: "High", color: "var(--danger)", soft: "var(--danger-soft)" },
  { value: "medium", label: "Medium", color: "var(--brass)", soft: "var(--brass-soft)" },
  { value: "low", label: "Low", color: "var(--text-dim)", soft: "var(--surface-2)" },
];

function Segmented({ options, value, onChange, column }) {
  return (
    <div style={{ display: "flex", flexDirection: column ? "column" : "row", gap: column ? 3 : 4 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: column ? undefined : 1,
              textAlign: column ? "left" : "center",
              background: active ? opt.soft : "transparent",
              border: `1px solid ${active ? opt.color : "var(--border)"}`,
              color: active ? opt.color : "var(--text-dim)",
              fontFamily: "var(--font-sans)",
              fontSize: "0.72rem",
              fontWeight: 500,
              padding: "6px 8px",
              borderRadius: "var(--r-sm)",
              cursor: "pointer",
              transition: "all .15s var(--ease)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── inline editable field ─────────────────────────────────────────────────────
function EditableField({ label, value, multiline, onChange, muted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft.trim());
  };

  return (
    <div style={D.fieldWrap}>
      <Label>{label}</Label>
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (!multiline && e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          rows={multiline ? 4 : 1}
          className="input-field"
          style={multiline ? { resize: "vertical", minHeight: 72, lineHeight: 1.6 } : { resize: "none", height: 38 }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{ ...D.fieldValueBtn, color: muted ? "var(--text-dim)" : "var(--text)" }}
        >
          {value || <span style={{ color: "var(--muted)" }}>Click to edit</span>}
        </button>
      )}
    </div>
  );
}

// ── subtask row ───────────────────────────────────────────────────────────────
function SubtaskRow({ subtask, projectId, onToggle, onDelete, canManage }) {
  const [loading, setLoading] = useState(false);
  const done = subtask.isCompleted;

  const toggle = async () => {
    setLoading(true);
    try {
      await taskService.updateSubtask(projectId, subtask._id, { isCompleted: !done });
      onToggle(subtask._id, !done);
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
      animate={{ opacity: loading ? 0.5 : 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18, ease: EASE }}
      style={D.subtaskRow}
    >
      <button onClick={toggle} disabled={loading} aria-label={done ? "Mark incomplete" : "Mark complete"} style={D.chkBtn}>
        <motion.span
          animate={{ scale: done ? 1.05 : 1 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          style={{ ...D.chk, background: done ? "var(--signal)" : "transparent", borderColor: done ? "var(--signal)" : "var(--border-hi)" }}
        >
          <motion.svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--signal-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M20 6L9 17l-5-5" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={{ duration: 0.25, ease: EASE_OUT }} />
          </motion.svg>
        </motion.span>
      </button>
      <span style={{ ...D.subtaskTitle, color: done ? "var(--text-dim)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>
        {subtask.title}
      </span>
      {canManage && (
        <button onClick={remove} aria-label="Delete subtask" style={D.iconBtn}>
          <XIcon />
        </button>
      )}
    </motion.div>
  );
}

// ── add subtask inline ────────────────────────────────────────────────────────
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
    if (!title) { setActive(false); setValue(""); return; }
    setLoading(true);
    try {
      const newSt = await taskService.createSubtask(projectId, taskId, { title });
      onAdded(newSt);
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 40);
    } catch (e) {
      console.error("Add subtask failed", e);
    } finally {
      setLoading(false);
    }
  };

  if (!active) {
    return (
      <button onClick={() => setActive(true)} style={D.addTrigger}>
        <span style={{ color: "var(--signal)", fontSize: 14, lineHeight: 1 }}>+</span> Add subtask
      </button>
    );
  }

  return (
    <div style={{ ...D.subtaskRow, marginTop: 4 }}>
      <span style={{ ...D.chk, borderColor: "var(--border-hi)", flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(""); setActive(false); } }}
        placeholder="Subtask title…"
        disabled={loading}
        className="input-field"
        style={{ padding: "5px 8px", fontSize: "0.8rem" }}
        maxLength={120}
      />
      <button onClick={commit} disabled={loading || !value.trim()} aria-label="Add subtask" style={{ ...D.iconBtn, color: "var(--signal)", opacity: value.trim() && !loading ? 1 : 0.35 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </button>
    </div>
  );
}

// ── main drawer ───────────────────────────────────────────────────────────────
export default function TaskDetailDrawer({
  task,
  projectId,
  members = [],
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  canManage = false,
}) {
  const [localTask, setLocalTask] = useState(task);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) setLocalTask(task);
  }, [task]);

  if (!localTask) return null;

  const patch = async (field, value) => {
    const update = { [field]: value };
    setLocalTask((t) => ({ ...t, ...update }));
    onUpdate?.(localTask._id, update);
    setSaving(true);
    try {
      await taskService.updateTask(projectId, localTask._id, update);
    } catch (e) {
      console.error("Task update failed", e);
      setLocalTask(task);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm("Delete this task? This can't be undone.")) return;
    try {
      await taskService.deleteTask(projectId, localTask._id);
      onDelete?.(localTask._id);
      onClose();
    } catch (e) {
      console.error("Task delete failed", e);
    }
  };

  const handleSubtaskToggle = (subId, isCompleted) =>
    setLocalTask((t) => ({ ...t, subTasks: t.subTasks.map((s) => (s._id === subId ? { ...s, isCompleted } : s)) }));
  const handleSubtaskDelete = (subId) =>
    setLocalTask((t) => ({ ...t, subTasks: t.subTasks.filter((s) => s._id !== subId) }));
  const handleSubtaskAdd = (newSubtask) =>
    setLocalTask((t) => ({ ...t, subTasks: [...(t.subTasks || []), newSubtask] }));

  const statusCfg = STATUS_OPTIONS.find((s) => s.value === localTask.status) || STATUS_OPTIONS[0];
  const priorityCfg = PRIORITY_OPTIONS.find((p) => p.value === localTask.priority) || PRIORITY_OPTIONS[1];
  const doneCount = localTask.subTasks?.filter((s) => s.isCompleted).length || 0;
  const totalCount = localTask.subTasks?.length || 0;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width={440} labelledBy="task-drawer-title">
      {/* Header */}
      <div style={D.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {localTask.taskKey ? (
            <TaskKeyBadge taskKey={localTask.taskKey} size="md" />
          ) : (
            // Legacy fallback — a task created before the Phase 1 migration
            // ran has no keyPrefix yet. Not click-to-copy: a raw ID fragment
            // isn't the stable, human-typable identity taskKey is for.
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-dim)" }}>
              #{localTask._id?.slice(-6).toUpperCase()}
            </span>
          )}
          <AnimatePresence>
            {saving && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--brass)" }}>
                saving…
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canManage && (
            <Button variant="danger" onClick={handleDeleteTask} style={{ padding: "5px 10px", fontSize: "0.72rem" }}>
              Delete
            </Button>
          )}
          <button onClick={onClose} aria-label="Close" style={D.iconBtn}><XIcon /></button>
        </div>
      </div>

      {/* Content */}
      <div style={D.content} className="scroll-area">
        <div id="task-drawer-title">
          {canManage ? (
            <EditableField label="Task title" value={localTask.title} onChange={(v) => patch("title", v)} />
          ) : (
            <div style={D.fieldWrap}>
              <Label>Task title</Label>
              <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>{localTask.title}</span>
            </div>
          )}
        </div>

        {canManage ? (
          <EditableField label="Description" value={localTask.description || ""} multiline muted onChange={(v) => patch("description", v)} />
        ) : localTask.description ? (
          <div style={D.fieldWrap}>
            <Label>Description</Label>
            <p style={{ fontSize: "0.83rem", color: "var(--text-soft)", lineHeight: 1.6 }}>{localTask.description}</p>
          </div>
        ) : null}

        <div className="divider" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={D.fieldWrap}>
            <Label>Status</Label>
            {canManage ? (
              <Segmented options={STATUS_OPTIONS} value={localTask.status} onChange={(v) => patch("status", v)} column />
            ) : (
              <span style={{ ...D.chip, color: statusCfg.color, background: statusCfg.soft }}>{statusCfg.label}</span>
            )}
          </div>
          <div style={D.fieldWrap}>
            <Label>Priority</Label>
            {canManage ? (
              <Segmented options={PRIORITY_OPTIONS} value={localTask.priority} onChange={(v) => patch("priority", v)} column />
            ) : (
              <span style={{ ...D.chip, color: priorityCfg.color, background: priorityCfg.soft }}>{priorityCfg.label}</span>
            )}
          </div>
        </div>

        {(localTask.assignee || canManage) && (
          <div style={D.fieldWrap}>
            <Label>Assigned to</Label>
            {canManage ? (
              <select value={localTask.assignee?._id || ""} onChange={(e) => patch("assigneeId", e.target.value)} className="input-field" style={{ cursor: "pointer" }}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            ) : localTask.assignee ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={D.avatar}>{localTask.assignee.name?.[0]?.toUpperCase() || "?"}</span>
                <span style={{ fontSize: "0.83rem", color: "var(--text)" }}>{localTask.assignee.name}</span>
              </div>
            ) : (
              <span style={{ color: "var(--text-dim)", fontSize: "0.83rem" }}>Unassigned</span>
            )}
          </div>
        )}

        <div className="divider" />

        {/* Subtasks */}
        <div style={D.fieldWrap}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Label>Subtasks</Label>
            {totalCount > 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem", color: "var(--text-dim)" }}>
                {doneCount}/{totalCount} done
              </span>
            )}
          </div>

          {totalCount > 0 && (
            <div className="progress-bar" style={{ marginBottom: 8 }}>
              <motion.div
                className="progress-fill"
                style={{ background: doneCount === totalCount ? "var(--signal)" : "var(--brass)" }}
                animate={{ width: `${(doneCount / totalCount) * 100}%` }}
                transition={{ duration: 0.3, ease: EASE }}
              />
            </div>
          )}

          <AnimatePresence initial={false}>
            {localTask.subTasks?.map((st) => (
              <SubtaskRow key={st._id} subtask={st} projectId={projectId} onToggle={handleSubtaskToggle} onDelete={handleSubtaskDelete} canManage={canManage} />
            ))}
          </AnimatePresence>

          {totalCount === 0 && !canManage && (
            <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>No subtasks</span>
          )}

          {canManage && <AddSubtaskInput projectId={projectId} taskId={localTask._id} onAdded={handleSubtaskAdd} />}
        </div>

        {localTask.attachments?.length > 0 && (
          <>
            <div className="divider" />
            <div style={D.fieldWrap}>
              <Label>Attachments ({localTask.attachments.length})</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {localTask.attachments.map((att, i) => (
                  <a key={i} href={att.url} target="_blank" rel="noreferrer" style={D.attach}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {att.url?.split("/").pop() || `File ${i + 1}`}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-dim)" }}>
                      {att.size ? `${Math.round(att.size / 1024)}KB` : ""}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
  );
}

const D = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  content: { flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: 16 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  fieldValueBtn: {
    background: "none",
    border: "none",
    textAlign: "left",
    padding: 0,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: "0.95rem",
    fontWeight: 500,
    lineHeight: 1.5,
    width: "100%",
  },
  chip: {
    display: "inline-block",
    alignSelf: "flex-start",
    fontFamily: "var(--font-mono)",
    fontSize: "0.64rem",
    padding: "3px 8px",
    borderRadius: "var(--r-sm)",
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "var(--signal-soft)",
    color: "var(--signal)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: "0.66rem",
    fontWeight: 600,
  },
  subtaskRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0" },
  chkBtn: { background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, display: "flex" },
  chk: {
    width: 15,
    height: 15,
    borderRadius: 4,
    border: "1.5px solid var(--border-hi)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  subtaskTitle: { fontSize: "0.83rem", flex: 1 },
  iconBtn: { background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex", padding: 3, flexShrink: 0 },
  addTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "none",
    border: "1px dashed var(--border)",
    borderRadius: "var(--r-md)",
    color: "var(--text-dim)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.8rem",
    padding: "7px 10px",
    cursor: "pointer",
    marginTop: 6,
    width: "100%",
  },
  attach: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "7px 10px",
    textDecoration: "none",
  },
};
