import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { EASE } from "../../motion/tokens";

// ═══════════════════════════════════════════════════════════════════════════
// Shared overlay behavior: Esc to close, focus trap, focus restore on close,
// and body scroll lock. Used by both Modal (centered) and Drawer (right slide).
// ═══════════════════════════════════════════════════════════════════════════
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useOverlayBehavior(isOpen, onClose) {
  const panelRef = useRef(null);
  const lastFocused = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    lastFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const nodes = panel.querySelectorAll(FOCUSABLE);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);

    const t = setTimeout(() => {
      const panel = panelRef.current;
      const focusable = panel?.querySelector(FOCUSABLE);
      focusable?.focus();
    }, 60);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      const el = lastFocused.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [isOpen, onClose]);

  return panelRef;
}

// ─── Modal (centered) ───────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, children, maxWidth = 480, bare = false, labelledBy }) {
  const panelRef = useOverlayBehavior(isOpen, onClose);
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onMouseDown={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className="modal-panel"
            style={
              bare
                ? { maxWidth, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
                : { maxWidth }
            }
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Drawer (right slide-in) ─────────────────────────────────────────────────────
export function Drawer({ isOpen, onClose, children, width = 440, labelledBy }) {
  const panelRef = useOverlayBehavior(isOpen, onClose);
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            onMouseDown={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(6,7,8,.6)",
              backdropFilter: "blur(3px)",
              zIndex: 1100,
            }}
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100vh",
              width,
              maxWidth: "94vw",
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "var(--shadow-xl)",
              zIndex: 1101,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Shared modal chrome ─────────────────────────────────────────────────────────
export function ModalHeader({ title, subtitle, onClose, id, right }) {
  return (
    <div style={HS.header}>
      <div style={{ minWidth: 0 }}>
        <div id={id} style={HS.title}>{title}</div>
        {subtitle && <div style={HS.subtitle}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {right}
        <button onClick={onClose} aria-label="Close" style={HS.close}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const HS = {
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "1.1rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  subtitle: { fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 2 },
  close: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    cursor: "pointer",
    display: "flex",
    padding: 4,
    borderRadius: "var(--r-sm)",
  },
};

export default Modal;
