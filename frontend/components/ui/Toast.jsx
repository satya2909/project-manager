import { createContext, useContext, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { EASE } from "../../motion/tokens";

// ═══════════════════════════════════════════════════════════════════════════
// Toast — feedback on state changes. useToast().toast(msg, { kind, duration }).
// kind: "success" | "info" | "danger". Bottom-right stack, auto-dismiss ~2.6s.
// role="status" + aria-live polite; reduced motion is handled by MotionConfig.
// ═══════════════════════════════════════════════════════════════════════════

const ToastContext = createContext(null);
let counter = 0;

const DOT = {
  success: "var(--signal)",
  info: "var(--brass)",
  danger: "var(--danger)",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    (message, opts = {}) => {
      const id = ++counter;
      const kind = opts.kind || "info";
      const duration = opts.duration ?? 2600;
      setToasts((t) => [...t, { id, message, kind }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div style={VP} role="region" aria-label="Notifications">
            <AnimatePresence initial={false}>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  role="status"
                  aria-live="polite"
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  onClick={() => dismiss(t.id)}
                  style={ITEM}
                >
                  <span style={{ ...DOTSTYLE, background: DOT[t.kind] || DOT.info }} />
                  <span>{t.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const VP = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 2000,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  alignItems: "flex-end",
  pointerEvents: "none",
};

const ITEM = {
  pointerEvents: "auto",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "var(--panel-hi)",
  border: "1px solid var(--border-hi)",
  borderRadius: "var(--r-md)",
  padding: "12px 16px",
  fontFamily: "var(--font-sans)",
  fontSize: "0.82rem",
  color: "var(--text)",
  boxShadow: "var(--shadow-xl)",
  maxWidth: 340,
};

const DOTSTYLE = { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 };
