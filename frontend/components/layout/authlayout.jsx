import { motion } from "framer-motion";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import { fadeUp, stagger } from "../../motion/tokens";

// ═══════════════════════════════════════════════════════════════════════════
// AuthLayout — calm centered card on the themed radial wash (DESIGN.md §7).
// The auth screens are the first impression, so they carry a bit more of the
// "instrument" identity: brand mark above a single quiet card. Theme toggle in
// the corner so a preference can be set before signing in.
// ═══════════════════════════════════════════════════════════════════════════
export default function AuthLayout({ children }) {
  return (
    <div style={S.root}>
      <div style={S.toggle}>
        <ThemeToggle />
      </div>

      {/* Subtle blueprint grid, faded toward the edges */}
      <div className="grid-texture" style={S.grid} aria-hidden />

      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" style={S.stack}>
        <motion.div variants={fadeUp} style={S.brand}>
          <div style={S.mark}>
            <span style={S.markInner} />
          </div>
          <span style={S.wordmark}>
            project<span style={{ color: "var(--signal)" }}>camp</span>
          </span>
        </motion.div>

        <motion.div variants={fadeUp} style={S.card}>
          {children}
        </motion.div>

        <motion.div variants={fadeUp} style={S.foot}>
          Operator console for teams
        </motion.div>
      </motion.div>
    </div>
  );
}

const S = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1.25rem",
    position: "relative",
    overflow: "hidden",
  },
  toggle: { position: "absolute", top: 20, right: 20, zIndex: 3 },
  grid: {
    position: "absolute",
    inset: 0,
    opacity: 0.5,
    pointerEvents: "none",
    WebkitMaskImage: "radial-gradient(circle at 50% 38%, #000, transparent 72%)",
    maskImage: "radial-gradient(circle at 50% 38%, #000, transparent 72%)",
  },
  stack: { width: "100%", maxWidth: 420, position: "relative", zIndex: 1 },
  brand: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 22 },
  mark: {
    width: 30,
    height: 30,
    borderRadius: "var(--r-sm)",
    background: "var(--signal)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  markInner: { width: 13, height: 13, borderRadius: 1, background: "var(--signal-ink)" },
  wordmark: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "1.15rem",
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    boxShadow: "var(--shadow-lg)",
    padding: "2rem",
  },
  foot: {
    textAlign: "center",
    marginTop: 18,
    fontFamily: "var(--font-mono)",
    fontSize: "0.66rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
};
