// ═══════════════════════════════════════════════════════════════════════════
// Motion tokens — Project Camp "Precision Terminal" (DESIGN.md §6 / motion-patterns.md)
// Import these instead of hand-typing cubic-beziers or variants per component, so
// the "quality" curve and the entrance choreography are declared exactly once.
// ═══════════════════════════════════════════════════════════════════════════

export const EASE = [0.16, 1, 0.3, 1]; // the "quality" curve — 95% of transitions
export const EASE_OUT = [0.22, 1, 0.36, 1]; // snappier — toggles, quick confirmations

// A single element rising into place (opacity + 14px lift).
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

// Container that sequences its children. Nest for shell → block → item cascades.
export const stagger = (delay = 0.05) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

// Modal / palette panel: scale up from 98% with a small rise.
export const popIn = {
  hidden: { opacity: 0, scale: 0.98, y: -8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
  exit: { opacity: 0, scale: 0.98, y: -8, transition: { duration: 0.2, ease: EASE } },
};

// Veil / backdrop fade.
export const veil = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: EASE } },
};
