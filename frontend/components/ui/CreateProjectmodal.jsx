import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateProjectModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef(null);

  // Focus name on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 120);
      setForm({ name: "", description: "" });
      setErrors({});
      setSubmitted(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "PROJECT NAME REQUIRED";
    else if (form.name.trim().length < 3) errs.name = "MIN 3 CHARACTERS";
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
        name: form.name.trim(),
        description: form.description.trim(),
      });
      setSubmitted(true);
      setTimeout(onClose, 700);
    } catch (e) {
      setErrors({ submit: e?.message || "SUBMISSION FAILED" });
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={M.backdrop}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={M.modal}
          >
            {/* Corner decorators */}
            <div
              style={{
                ...M.corner,
                top: -1,
                left: -1,
                borderTop: "2px solid var(--phosphor)",
                borderLeft: "2px solid var(--phosphor)",
              }}
            />
            <div
              style={{
                ...M.corner,
                top: -1,
                right: -1,
                borderTop: "2px solid var(--phosphor)",
                borderRight: "2px solid var(--phosphor)",
              }}
            />
            <div
              style={{
                ...M.corner,
                bottom: -1,
                left: -1,
                borderBottom: "2px solid var(--phosphor)",
                borderLeft: "2px solid var(--phosphor)",
              }}
            />
            <div
              style={{
                ...M.corner,
                bottom: -1,
                right: -1,
                borderBottom: "2px solid var(--phosphor)",
                borderRight: "2px solid var(--phosphor)",
              }}
            />

            {/* Header */}
            <div style={M.header}>
              <div style={M.headerLeft}>
                <div style={M.headerIcon}>◈</div>
                <div>
                  <div style={M.title}>INIT NEW PROJECT</div>
                  <div style={M.subtitle}>SYS://PROJECTS/CREATE</div>
                </div>
              </div>
              <button onClick={onClose} style={M.closeBtn}>
                ✕
              </button>
            </div>

            <div style={M.divider} />

            {/* Body */}
            <div style={M.body}>
              {/* Name field */}
              <div style={M.field}>
                <label style={M.label}>
                  PROJECT NAME
                  <span style={M.required}> *</span>
                </label>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={set("name")}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="E.G. OPERATION BLACKSITE"
                  style={{
                    ...M.input,
                    borderColor: errors.name
                      ? "var(--red)"
                      : form.name
                        ? "var(--phosphor-dim)"
                        : "var(--border)",
                    boxShadow: errors.name
                      ? "0 0 8px rgba(255,60,60,0.15)"
                      : form.name
                        ? "0 0 8px rgba(0,255,65,0.08)"
                        : "none",
                  }}
                  maxLength={60}
                />
                {errors.name && <span style={M.error}>{errors.name}</span>}
              </div>

              {/* Description field */}
              <div style={M.field}>
                <label style={M.label}>DESCRIPTION</label>
                <textarea
                  value={form.description}
                  onChange={set("description")}
                  placeholder="BRIEF MISSION OVERVIEW..."
                  rows={4}
                  style={{
                    ...M.input,
                    ...M.textarea,
                    borderColor: form.description
                      ? "var(--phosphor-dim)"
                      : "var(--border)",
                    boxShadow: form.description
                      ? "0 0 8px rgba(0,255,65,0.08)"
                      : "none",
                  }}
                  maxLength={500}
                />
                <span style={M.charCount}>{form.description.length}/500</span>
              </div>

              {errors.submit && (
                <div style={M.errorBanner}>⚠ {errors.submit}</div>
              )}
            </div>

            <div style={M.divider} />

            {/* Footer */}
            <div style={M.footer}>
              <button onClick={onClose} style={M.cancelBtn} disabled={loading}>
                ABORT
              </button>
              <button
                onClick={handleSubmit}
                style={M.submitBtn}
                disabled={loading || submitted}
              >
                {submitted ? (
                  <span style={{ color: "var(--phosphor)" }}>
                    ✓ INITIALIZED
                  </span>
                ) : loading ? (
                  <span style={M.spinner}>◌ PROCESSING...</span>
                ) : (
                  "INITIALIZE PROJECT"
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const M = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(2px)",
    zIndex: 1000,
  },
  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: 480,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    zIndex: 1001,
    fontFamily: "var(--font-mono)",
  },
  corner: {
    position: "absolute",
    width: 12,
    height: 12,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 32,
    height: 32,
    background: "rgba(0,255,65,0.1)",
    border: "1px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontSize: 14,
    boxShadow: "0 0 10px rgba(0,255,65,0.2)",
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
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 12,
    padding: 4,
    transition: "color 0.15s",
  },
  divider: {
    height: 1,
    background: "var(--border)",
  },
  body: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    position: "relative",
  },
  label: {
    fontSize: 9,
    letterSpacing: 2,
    color: "var(--muted)",
  },
  required: {
    color: "var(--red)",
  },
  input: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: 1,
    padding: "10px 12px",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    resize: "vertical",
    minHeight: 88,
    lineHeight: 1.6,
  },
  charCount: {
    fontSize: 8,
    color: "var(--muted)",
    letterSpacing: 1,
    alignSelf: "flex-end",
  },
  error: {
    fontSize: 8,
    color: "var(--red)",
    letterSpacing: 2,
  },
  errorBanner: {
    background: "rgba(255,60,60,0.08)",
    border: "1px solid var(--red)",
    color: "var(--red)",
    fontSize: 9,
    letterSpacing: 1,
    padding: "8px 12px",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "14px 20px",
  },
  cancelBtn: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "9px 18px",
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  submitBtn: {
    background: "rgba(0,255,65,0.08)",
    border: "1px solid var(--phosphor)",
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: 2,
    padding: "9px 20px",
    cursor: "pointer",
    transition: "background 0.15s, box-shadow 0.15s",
  },
  spinner: {
    animation: "pulse 1s ease-in-out infinite",
    display: "inline-block",
  },
};
