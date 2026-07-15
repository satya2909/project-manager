import { createContext, useContext, useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Theme context — dark (brand-forward default) + light. (DESIGN.md §7)
//
// First paint is handled by the inline script in index.html, which sets
// data-theme BEFORE React mounts (saved preference → system preference → dark),
// so there is no dark→light flash. This provider simply reads whatever the DOM
// already reflects and owns the toggle from there.
// ═══════════════════════════════════════════════════════════════════════════

const ThemeContext = createContext(null);
const STORAGE_KEY = "pc-theme";

function currentDomTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(currentDomTheme);

  const apply = useCallback((next) => {
    const root = document.documentElement;
    if (next === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme"); // absence = dark
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode / storage disabled — non-fatal */
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    apply(theme === "light" ? "dark" : "light");
  }, [theme, apply]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme: apply }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
