import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

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

// ── small reusable select ─────────────────────────────────────────────────────
function SegmentSelect({ options, value, onChange }) {
  return (
    <div style={S.segWrap}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            ...S.segBtn,
            borderColor: value === opt.value ? opt.color : "var(--border)",
            color: value === opt.value ? opt.color : "var(--muted)",
            background: value === opt.value ? `${opt.color}12` : "transparent",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── subtask row ───────────────────────────────────────────────────────────────
function SubtaskRow({ subtask, index, onChange, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.18 }}
      style={S.subtaskRow}
    >
      <span style={S.subtaskIdx}>ST-{String(index + 1).padStart(2, "0")}</span>
      <input
        value={subtask.title}
        onChange={(e) => onChange(index, e.target.value)}
        placeholder="SUBTASK DESCRIPTION..."
        style={S.subtaskInput}
        maxLength={120}
      />
      <button onClick={() => onRemove(index)} style={S.subtaskRemove}>
        ✕
      </button>
    </motion.div>
  );
}

// ── main modal ────────────────────────────────────────────────────────────────
export default function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  members = [],
  projectName = "",
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: "",
  });
  const [subtasks, setSubtasks] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState("details"); // details | subtasks
  const titleRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 120);
      setForm({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        assigneeId: "",
      });
      setSubtasks([]);
      setErrors({});
      setSubmitted(false);
      setActiveTab("details");
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const setField = (k) => (v) => {
    const val = v?.target !== undefined ? v.target.value : v;
    setForm((f) => ({ ...f, [k]: val }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const addSubtask = () => {
    setSubtasks((s) => [...s, { title: "" }]);
    setActiveTab("subtasks");
  };

  const updateSubtask = (i, title) =>
    setSubtasks((s) => s.map((st, idx) => (idx === i ? { ...st, title } : st)));

  const removeSubtask = (i) =>
    setSubtasks((s) => s.filter((_, idx) => idx !== i));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = "TASK TITLE REQUIRED";
    else if (form.title.trim().length < 3) errs.title = "MIN 3 CHARACTERS";
    subtasks.forEach((st, i) => {
      if (!st.title.trim()) errs[`st_${i}`] = true;
    });
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      await onSubmit?.({
        ...form,
        subtasks: subtasks.filter((s) => s.title.trim()),
      });
      setSubmitted(true);
      setTimeout(onClose, 700);
    } catch (e) {
      setErrors({ submit: e?.message || "SUBMISSION FAILED" });
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: "details", label: "DETAILS" },
    { id: "subtasks", label: `SUBTASKS [${subtasks.length}]` },
  ];

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={S.backdrop}
          />

          <div style={S.wrapper}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={S.modal}
            >
            {/* Corner brackets */}
            {[
              {
                top: -1,
                left: -1,
                borderTop: "2px solid var(--amber)",
                borderLeft: "2px solid var(--amber)",
              },
              {
                top: -1,
                right: -1,
                borderTop: "2px solid var(--amber)",
                borderRight: "2px solid var(--amber)",
              },
              {
                bottom: -1,
                left: -1,
                borderBottom: "2px solid var(--amber)",
                borderLeft: "2px solid var(--amber)",
              },
              {
                bottom: -1,
                right: -1,
                borderBottom: "2px solid var(--amber)",
                borderRight: "2px solid var(--amber)",
              },
            ].map((c, i) => (
              <div key={i} style={{ ...S.corner, ...c }} />
            ))}

            {/* Header */}
            <div style={S.header}>
              <div style={S.headerLeft}>
                <div
                  style={{
                    ...S.headerIcon,
                    borderColor: "var(--amber)",
                    boxShadow: "0 0 10px rgba(255,170,0,0.2)",
                    color: "var(--amber)",
                  }}
                >
                  ▣
                </div>
                <div>
                  <div style={S.title}>CREATE TASK</div>
                  <div style={S.subtitle}>
                    {projectName
                      ? `SYS://PROJECTS/${projectName.toUpperCase()}/TASKS`
                      : "SYS://TASKS/CREATE"}
                  </div>
                </div>
              </div>
              <div style={S.headerRight}>
                <button onClick={addSubtask} style={S.addSubtaskBtn}>
                  + SUBTASK
                </button>
                <button onClick={onClose} style={S.closeBtn}>
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={S.tabBar}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...S.tab,
                    color:
                      activeTab === tab.id ? "var(--amber)" : "var(--muted)",
                    borderBottom:
                      activeTab === tab.id
                        ? "2px solid var(--amber)"
                        : "2px solid transparent",
                  }}
                >
                  {tab.label}
                </button>
              ))}
              <div style={S.tabFill} />
            </div>

            {/* Body */}
            <div style={S.body}>
              <AnimatePresence mode="wait">
                {activeTab === "details" ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    style={S.tabPane}
                  >
                    {/* Title */}
                    <div style={S.field}>
                      <label style={S.label}>
                        TASK TITLE <span style={S.req}>*</span>
                      </label>
                      <input
                        ref={titleRef}
                        value={form.title}
                        onChange={setField("title")}
                        placeholder="WHAT NEEDS TO BE DONE?"
                        style={{
                          ...S.input,
                          borderColor: errors.title
                            ? "var(--red)"
                            : form.title
                              ? "var(--amber)"
                              : "var(--border)",
                          boxShadow: errors.title
                            ? "0 0 8px rgba(255,60,60,0.15)"
                            : form.title
                              ? "0 0 8px rgba(255,170,0,0.08)"
                              : "none",
                        }}
                        maxLength={100}
                      />
                      {errors.title && (
                        <span style={S.error}>{errors.title}</span>
                      )}
                    </div>

                    {/* Description */}
                    <div style={S.field}>
                      <label style={S.label}>DESCRIPTION</label>
                      <textarea
                        value={form.description}
                        onChange={setField("description")}
                        placeholder="DETAILED MISSION BRIEF..."
                        rows={3}
                        style={{
                          ...S.input,
                          ...S.textarea,
                          borderColor: form.description
                            ? "var(--amber)"
                            : "var(--border)",
                        }}
                        maxLength={500}
                      />
                    </div>

                    {/* Status + Priority row */}
                    <div style={S.row2}>
                      <div style={S.field}>
                        <label style={S.label}>STATUS</label>
                        <SegmentSelect
                          options={STATUS_OPTIONS}
                          value={form.status}
                          onChange={setField("status")}
                        />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>PRIORITY</label>
                        <SegmentSelect
                          options={PRIORITY_OPTIONS}
                          value={form.priority}
                          onChange={setField("priority")}
                        />
                      </div>
                    </div>

                    {/* Assignee */}
                    {members.length > 0 && (
                      <div style={S.field}>
                        <label style={S.label}>ASSIGN TO</label>
                        <select
                          value={form.assigneeId}
                          onChange={setField("assigneeId")}
                          style={{ ...S.input, ...S.select }}
                        >
                          <option value="">— UNASSIGNED —</option>
                          {members.map((m) => (
                            <option key={m._id} value={m._id}>
                              {m.name?.toUpperCase() || m.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {errors.submit && (
                      <div style={S.errorBanner}>⚠ {errors.submit}</div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="subtasks"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    style={S.tabPane}
                  >
                    {subtasks.length === 0 ? (
                      <div style={S.emptySubtasks}>
                        <span style={S.emptyIcon}>◫</span>
                        <span>NO SUBTASKS YET</span>
                        <button onClick={addSubtask} style={S.emptyAddBtn}>
                          + ADD FIRST SUBTASK
                        </button>
                      </div>
                    ) : (
                      <div style={S.subtaskList}>
                        <AnimatePresence>
                          {subtasks.map((st, i) => (
                            <SubtaskRow
                              key={i}
                              subtask={st}
                              index={i}
                              onChange={updateSubtask}
                              onRemove={removeSubtask}
                            />
                          ))}
                        </AnimatePresence>
                        <button onClick={addSubtask} style={S.addMoreBtn}>
                          + ADD SUBTASK
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={S.divider} />

            {/* Footer */}
            <div style={S.footer}>
              <span style={S.footerMeta}>
                {subtasks.length > 0 &&
                  `${subtasks.length} SUBTASK${subtasks.length > 1 ? "S" : ""} QUEUED`}
              </span>
              <div style={S.footerBtns}>
                <button
                  onClick={onClose}
                  style={S.cancelBtn}
                  disabled={loading}
                >
                  ABORT
                </button>
                <button
                  onClick={handleSubmit}
                  style={S.submitBtn}
                  disabled={loading || submitted}
                >
                  {submitted ? (
                    <span style={{ color: "var(--phosphor)" }}>✓ DEPLOYED</span>
                  ) : loading ? (
                    "◌ DEPLOYING..."
                  ) : (
                    "DEPLOY TASK"
                  )}
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}

const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(2px)",
    zIndex: 1000,
  },
  wrapper: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1001,
    pointerEvents: "none",
  },
  modal: {
    width: 520,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    fontFamily: "var(--font-mono)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "90vh",
    position: "relative",
    pointerEvents: "auto",
  },
  corner: { position: "absolute", width: 12, height: 12 },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  headerIcon: {
    width: 32,
    height: 32,
    background: "rgba(255,170,0,0.1)",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
  },
  title: {
    color: "var(--text)",
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "bold",
  },
  subtitle: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: 2,
    marginTop: 2,
  },

  addSubtaskBtn: {
    background: "rgba(255,170,0,0.06)",
    border: "1px solid var(--amber)",
    color: "var(--amber)",
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
    fontSize: 12,
    padding: 4,
  },

  tabBar: {
    display: "flex",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  tab: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "10px 20px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
    marginBottom: -1,
  },
  tabFill: { flex: 1, borderBottom: "1px solid var(--border)" },

  body: {
    flex: 1,
    overflowY: "auto",
    minHeight: 0,
  },
  tabPane: {
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 9, letterSpacing: 2, color: "var(--muted)" },
  req: { color: "var(--red)" },
  input: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: 1,
    padding: "9px 12px",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: { resize: "vertical", minHeight: 72, lineHeight: 1.6 },
  select: { cursor: "pointer", appearance: "none" },
  error: { fontSize: 8, color: "var(--red)", letterSpacing: 2 },
  errorBanner: {
    background: "rgba(255,60,60,0.08)",
    border: "1px solid var(--red)",
    color: "var(--red)",
    fontSize: 9,
    letterSpacing: 1,
    padding: "8px 12px",
  },

  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  segWrap: { display: "flex", gap: 4 },
  segBtn: {
    flex: 1,
    background: "transparent",
    border: "1px solid",
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 1,
    padding: "6px 4px",
    cursor: "pointer",
    transition: "all 0.12s",
    whiteSpace: "nowrap",
  },

  subtaskList: { display: "flex", flexDirection: "column", gap: 6 },
  subtaskRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    padding: "6px 10px",
  },
  subtaskIdx: {
    color: "var(--amber)",
    fontSize: 8,
    letterSpacing: 2,
    flexShrink: 0,
  },
  subtaskInput: {
    flex: 1,
    background: "none",
    border: "none",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 0.5,
    outline: "none",
    padding: "2px 0",
  },
  subtaskRemove: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 10,
    padding: 2,
    flexShrink: 0,
  },
  addMoreBtn: {
    background: "none",
    border: "1px dashed var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: 2,
    padding: "8px",
    cursor: "pointer",
    marginTop: 4,
    width: "100%",
    transition: "border-color 0.15s, color 0.15s",
  },
  emptySubtasks: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "40px 20px",
    color: "var(--muted)",
    fontSize: 9,
    letterSpacing: 2,
  },
  emptyIcon: { fontSize: 32, opacity: 0.3 },
  emptyAddBtn: {
    background: "rgba(255,170,0,0.06)",
    border: "1px solid var(--amber)",
    color: "var(--amber)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "8px 16px",
    cursor: "pointer",
    marginTop: 4,
  },

  divider: { height: 1, background: "var(--border)", flexShrink: 0 },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    flexShrink: 0,
  },
  footerMeta: { fontSize: 8, color: "var(--amber)", letterSpacing: 2 },
  footerBtns: { display: "flex", gap: 10 },
  cancelBtn: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "8px 16px",
    cursor: "pointer",
  },
  submitBtn: {
    background: "rgba(255,170,0,0.08)",
    border: "1px solid var(--amber)",
    color: "var(--amber)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "8px 20px",
    cursor: "pointer",
  },
};
