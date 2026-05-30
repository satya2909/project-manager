// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = "md" }) {
  const dim = size === "sm" ? 14 : size === "lg" ? 28 : 18;
  const border = size === "lg" ? 3 : 2;
  return (
    <span
      style={{
        display: "inline-block",
        width: dim,
        height: dim,
        border: `${border}px solid var(--border, #1e241e)`,
        borderTopColor: "var(--phosphor, #00ff41)",
        borderRadius: "50%",
        animation: "spin 600ms linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ── InlineError ───────────────────────────────────────────────────────────────
export function InlineError({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "10px 12px",
        background: "rgba(255,60,60,0.07)",
        border: "1px solid rgba(255,60,60,0.25)",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 11,
        color: "var(--red, #ff3c3c)",
        letterSpacing: 0.5,
        lineHeight: 1.5,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
      <span>{message}</span>
    </div>
  );
}

// ── InlineSuccess ─────────────────────────────────────────────────────────────
export function InlineSuccess({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "10px 12px",
        background: "rgba(0,255,65,0.07)",
        border: "1px solid rgba(0,255,65,0.25)",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 11,
        color: "var(--phosphor, #00ff41)",
        letterSpacing: 0.5,
        lineHeight: 1.5,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>✓</span>
      <span>{message}</span>
    </div>
  );
}

// ── default export: all three ─────────────────────────────────────────────────
export default { Spinner, InlineError, InlineSuccess };
