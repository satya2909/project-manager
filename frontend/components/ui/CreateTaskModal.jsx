import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal, ModalHeader } from "./Modal.jsx";
import { Button, Field, Input, Label, Spinner } from "./primitive.jsx";
import { EASE } from "../../motion/tokens";

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

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              background: active ? opt.soft : "transparent",
              border: `1px solid ${active ? opt.color : "var(--border)"}`,
              color: active ? opt.color : "var(--text-dim)",
              fontFamily: "var(--font-sans)",
              fontSize: "0.72rem",
              fontWeight: 500,
              padding: "7px 4px",
              borderRadius: "var(--r-sm)",
              cursor: "pointer",
              whiteSpace: "nowrap",
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

export default function CreateTaskModal({ isOpen, onClose, onSubmit, members = [], projectName = "" }) {
  const [form, setForm] = useState({ title: "", description: "", status: "todo", priority: "medium", assigneeId: "" });
  const [subtasks, setSubtasks] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState("details");

  useEffect(() => {
    if (isOpen) {
      setForm({ title: "", description: "", status: "todo", priority: "medium", assigneeId: "" });
      setSubtasks([]);
      setErrors({});
      setSubmitted(false);
      setTab("details");
    }
  }, [isOpen]);

  const setField = (k) => (v) => {
    const val = v?.target !== undefined ? v.target.value : v;
    setForm((f) => ({ ...f, [k]: val }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const addSubtask = () => {
    setSubtasks((s) => [...s, { title: "" }]);
    setTab("subtasks");
  };
  const updateSubtask = (i, title) => setSubtasks((s) => s.map((st, idx) => (idx === i ? { ...st, title } : st)));
  const removeSubtask = (i) => setSubtasks((s) => s.filter((_, idx) => idx !== i));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = "Task title is required";
    else if (form.title.trim().length < 3) errs.title = "Use at least 3 characters";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      setTab("details");
      return;
    }
    setLoading(true);
    try {
      await onSubmit?.({ ...form, subtasks: subtasks.filter((s) => s.title.trim()) });
      setSubmitted(true);
      setTimeout(onClose, 500);
    } catch (e) {
      setErrors({ submit: e?.message || "Couldn't create the task. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: "details", label: "Details" },
    { id: "subtasks", label: `Subtasks${subtasks.length ? ` (${subtasks.length})` : ""}` },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={520} bare labelledBy="create-task-title">
      <div style={{ padding: "1.5rem 1.5rem 0" }}>
        <ModalHeader
          id="create-task-title"
          title="Create task"
          subtitle={projectName ? `in ${projectName}` : undefined}
          onClose={onClose}
          right={
            <Button variant="ghost" onClick={addSubtask} style={{ padding: "6px 10px", fontSize: "0.76rem" }}>
              + Subtask
            </Button>
          }
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", padding: "14px 1.5rem 0" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t.id ? "var(--signal)" : "transparent"}`,
              color: tab === t.id ? "var(--text)" : "var(--text-dim)",
              fontFamily: "var(--font-sans)",
              fontSize: "0.82rem",
              fontWeight: 500,
              padding: "8px 4px",
              marginBottom: -1,
              cursor: "pointer",
              transition: "color .15s var(--ease), border-color .15s var(--ease)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 1.5rem" }} className="scroll-area">
        <AnimatePresence mode="wait">
          {tab === "details" ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15, ease: EASE }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <Field label="Task title" error={errors.title}>
                <Input
                  value={form.title}
                  onChange={setField("title")}
                  placeholder="What needs to be done?"
                  maxLength={100}
                  autoFocus
                />
              </Field>

              <Field label="Description">
                <Input
                  as="textarea"
                  value={form.description}
                  onChange={setField("description")}
                  placeholder="Add more detail…"
                  rows={3}
                  maxLength={500}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="input-group">
                  <Label>Status</Label>
                  <Segmented options={STATUS_OPTIONS} value={form.status} onChange={setField("status")} />
                </div>
                <div className="input-group">
                  <Label>Priority</Label>
                  <Segmented options={PRIORITY_OPTIONS} value={form.priority} onChange={setField("priority")} />
                </div>
              </div>

              {members.length > 0 && (
                <Field label="Assign to">
                  <select value={form.assigneeId} onChange={setField("assigneeId")} className="input-field" style={{ cursor: "pointer" }}>
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {errors.submit && <span className="input-error">{errors.submit}</span>}
            </motion.div>
          ) : (
            <motion.div
              key="subtasks"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15, ease: EASE }}
            >
              {subtasks.length === 0 ? (
                <div className="empty-state" style={{ padding: "2.5rem 1rem" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>
                    No subtasks yet
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    Break the task into smaller steps.
                  </span>
                  <Button variant="ghost" onClick={addSubtask} style={{ marginTop: 4 }}>
                    + Add first subtask
                  </Button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <AnimatePresence initial={false}>
                    {subtasks.map((st, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8, height: 0 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-dim)", flexShrink: 0, width: 22 }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Input
                          value={st.title}
                          onChange={(e) => updateSubtask(i, e.target.value)}
                          placeholder="Subtask…"
                          maxLength={120}
                          style={{ padding: "7px 10px" }}
                        />
                        <button onClick={() => removeSubtask(i)} aria-label="Remove subtask" style={rmBtn}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button variant="ghost" onClick={addSubtask} style={{ marginTop: 4, width: "100%", justifyContent: "center" }}>
                    + Add subtask
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 1.5rem", borderTop: "1px solid var(--border)" }}>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || submitted}>
          {submitted ? "Created" : loading ? <><Spinner size="sm" /> Creating…</> : "Create task"}
        </Button>
      </div>
    </Modal>
  );
}

const rmBtn = {
  background: "none",
  border: "none",
  color: "var(--text-dim)",
  cursor: "pointer",
  display: "flex",
  padding: 4,
  flexShrink: 0,
};
