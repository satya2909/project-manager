import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/theme.jsx";
import { EASE_OUT } from "../../motion/tokens";

// Physical sun/moon switch — one click, no menu, matches the "instrument" feel
// (DESIGN.md §7). Fully token-driven; the knob is the only Framer-animated part.
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isLight}
      aria-label="Toggle light and dark theme"
      title="Toggle light / dark"
      style={{
        position: "relative",
        width: 52,
        height: 28,
        borderRadius: 20,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background .4s var(--ease), border-color .4s var(--ease)",
      }}
    >
      <motion.span
        animate={{ x: isLight ? 24 : 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--panel-hi)",
          border: "1px solid var(--border-hi)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isLight ? (
          <Sun size={12} color="var(--brass)" strokeWidth={2} />
        ) : (
          <Moon size={12} color="var(--text-soft)" strokeWidth={2} />
        )}
      </motion.span>
    </button>
  );
}
