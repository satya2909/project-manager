import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// ─── TERMINAL LINES shown on the left panel ───────────────────────────────────
const TERMINAL_LINES = [
  {
    delay: 0,
    text: "> initializing project-camp v1.0.0",
    color: "var(--signal)",
  },
  {
    delay: 600,
    text: "> connecting to mongodb cluster...",
    color: "var(--ghost)",
  },
  { delay: 1200, text: "✓ database connected", color: "var(--signal)" },
  { delay: 1800, text: "> loading workspace modules", color: "var(--ghost)" },
  {
    delay: 2400,
    text: "✓ auth     [ jwt + refresh tokens ]",
    color: "var(--text-soft)",
  },
  {
    delay: 2700,
    text: "✓ projects [ crud + rbac ]",
    color: "var(--text-soft)",
  },
  {
    delay: 3000,
    text: "✓ tasks    [ kanban + subtasks ]",
    color: "var(--text-soft)",
  },
  {
    delay: 3300,
    text: "✓ notes    [ markdown + versioning ]",
    color: "var(--text-soft)",
  },
  {
    delay: 3800,
    text: "> system ready. awaiting operator.",
    color: "var(--amber)",
  },
];

function TerminalLine({ text, color, delay }) {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const show = setTimeout(() => {
      setVisible(true);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTyped(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, 18);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(show);
  }, [text, delay]);

  if (!visible) return null;

  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.75rem",
        color,
        lineHeight: 1.8,
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    >
      {typed}
    </div>
  );
}

// ─── STAT COUNTER ─────────────────────────────────────────────────────────────
function StatCard({ value, label, delay }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const step = Math.ceil(value / 40);
      const interval = setInterval(() => {
        start = Math.min(start + step, value);
        setCount(start);
        if (start >= value) clearInterval(interval);
      }, 30);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.2rem",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.75rem",
          fontWeight: 800,
          color: "var(--signal)",
          letterSpacing: "-0.03em",
          lineHeight: 1,
          textShadow: "0 0 20px rgba(0,229,160,0.3)",
        }}
      >
        {count.toLocaleString()}+
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--dim)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── LEFT PANEL ───────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div
      className="grid-texture"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "3rem",
        background: "var(--ink-90)",
        overflow: "hidden",
        minHeight: "100vh",
      }}
    >
      {/* Corner accent lines */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 80,
          height: 80,
          borderBottom: "1px solid var(--edge)",
          borderRight: "1px solid var(--edge)",
          borderRadius: "0 0 var(--r-lg) 0",
          opacity: 0.4,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 80,
          height: 80,
          borderTop: "1px solid var(--edge)",
          borderLeft: "1px solid var(--edge)",
          borderRadius: "var(--r-lg) 0 0 0",
          opacity: 0.4,
        }}
      />

      {/* Glow orb */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "20%",
          width: 320,
          height: 320,
          background:
            "radial-gradient(circle, rgba(0,229,160,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top — wordmark */}
      <div className="animate-fade-in delay-0">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.4rem",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "var(--signal)",
              borderRadius: "var(--r-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="var(--ink)" />
              <rect
                x="10"
                y="2"
                width="6"
                height="6"
                rx="1"
                fill="var(--ink)"
                opacity="0.5"
              />
              <rect
                x="2"
                y="10"
                width="6"
                height="6"
                rx="1"
                fill="var(--ink)"
                opacity="0.5"
              />
              <rect
                x="10"
                y="10"
                width="6"
                height="6"
                rx="1"
                fill="var(--ink)"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "1.1rem",
              color: "var(--text-bright)",
              letterSpacing: "-0.02em",
            }}
          >
            project<span style={{ color: "var(--signal)" }}>camp</span>
          </span>
        </div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            color: "var(--dim)",
            letterSpacing: "0.06em",
            marginLeft: "2.75rem",
          }}
        >
          collaborative workspace
        </p>
      </div>

      {/* Middle — terminal output */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "2rem 0",
        }}
      >
        {/* Big headline */}
        <div
          className="animate-fade-up delay-200"
          style={{ marginBottom: "2.5rem" }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 3.5vw, 3rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: "var(--text-bright)",
              marginBottom: "0.75rem",
            }}
          >
            Ship projects
            <br />
            <span
              style={{
                color: "var(--signal)",
                textShadow: "0 0 30px rgba(0,229,160,0.25)",
              }}
            >
              without chaos.
            </span>
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.82rem",
              color: "var(--ghost)",
              lineHeight: 1.7,
              maxWidth: 340,
            }}
          >
            Role-based access, Kanban boards, subtasks, and project notes —
            everything your team needs in one place.
          </p>
        </div>

        {/* Terminal block */}
        <div
          className="animate-fade-up delay-400"
          style={{
            background: "var(--ink)",
            border: "1px solid var(--edge)",
            borderRadius: "var(--r-lg)",
            padding: "1.25rem 1.5rem",
            maxWidth: 420,
          }}
        >
          {/* Terminal header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--edge)",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--rose)",
                opacity: 0.7,
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--amber)",
                opacity: 0.7,
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--signal)",
                opacity: 0.7,
              }}
            />
            <span
              style={{
                marginLeft: "0.5rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                color: "var(--muted)",
                letterSpacing: "0.06em",
              }}
            >
              project-camp — bash
            </span>
          </div>

          {/* Lines */}
          <div style={{ minHeight: 180 }}>
            {TERMINAL_LINES.map((line, i) => (
              <TerminalLine key={i} {...line} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom — stats */}
      <div className="animate-fade-up delay-600">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1.5rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--edge)",
          }}
        >
          <StatCard value={1200} label="projects managed" delay={800} />
          <StatCard value={8400} label="tasks completed" delay={1000} />
          <StatCard value={340} label="teams onboarded" delay={1200} />
        </div>
      </div>
    </div>
  );
}

// ─── AUTH LAYOUT ──────────────────────────────────────────────────────────────
export default function AuthLayout({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "100vh",
      }}
    >
      {/* Left — branding */}
      <div style={{ position: "sticky", top: 0, height: "100vh" }}>
        <LeftPanel />
      </div>

      {/* Right — form */}
      <div
        className="scroll-area"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 2rem",
          background: "var(--ink)",
          minHeight: "100vh",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
      </div>
    </div>
  );
}
