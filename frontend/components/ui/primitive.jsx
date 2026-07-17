// ═══════════════════════════════════════════════════════════════════════════
// Shared primitives — Project Camp "Precision Terminal"
// All className-based, reading tokens from index.css only. Zero hardcoded colors
// so every primitive repaints correctly under the light/dark toggle.
// (DESIGN.md §7 / REDESIGN-PLAN.md Phase 1)
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { TriangleAlert, Clock } from "lucide-react";
import { getDueDateStatus } from "../../utils/index.js";

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({ variant = "primary", className = "", children, ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

// ── IconButton ───────────────────────────────────────────────────────────────
export function IconButton({ className = "", children, ...props }) {
  return (
    <button className={`btn-icon ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ interactive = false, className = "", children, ...props }) {
  return (
    <div
      className={`card ${interactive ? "card-interactive" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
// tone: "todo" | "progress" | "done" | "admin" | "project-admin" | "member"
export function Badge({ tone = "member", className = "", children, ...props }) {
  return (
    <span className={`badge badge-${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

// ── DueDateBadge ─────────────────────────────────────────────────────────────
// Overdue/due-soon indicator, shared by TaskCard and TaskTable so both the
// Kanban board and every table view (per-project + org-wide hub) render the
// same rule. Icon + color, not color alone — WCAG 1.4.1, colorblind viewers
// can't rely on red-vs-amber to tell overdue from due-soon.
export function DueDateBadge({ task }) {
  const status = getDueDateStatus(task);
  if (!status) return null;

  if (status === "overdue") {
    return (
      <Badge tone="overdue">
        <TriangleAlert size={11} strokeWidth={2.25} />
        Overdue
      </Badge>
    );
  }

  return (
    <Badge tone="due-soon">
      <Clock size={11} strokeWidth={2.25} />
      Due soon
    </Badge>
  );
}

// ── TaskKeyBadge ─────────────────────────────────────────────────────────────
// Computed task key (`CAMP-104`) — genuinely data-like content, so mono per
// DESIGN.md §4. Click-to-copy with a --signal flash on success (one of the
// 3-4 places phosphor green is worth spending, per DESIGN.md §3). Falls back
// to nothing (not a placeholder) on legacy tasks with no key yet — a project
// created before Phase 1's migration, or mid-migration, has no keyPrefix to
// show, and a fake/guessed key would be worse than absence.
export function TaskKeyBadge({ taskKey, size = "sm" }) {
  const [copied, setCopied] = useState(false);
  if (!taskKey) return null;

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(taskKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard API can be unavailable (non-secure context, permission
      // denied) — fail silently rather than surface a broken copy button.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied!" : `Copy ${taskKey}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: size === "sm" ? "0.68rem" : "0.75rem",
        letterSpacing: "0.02em",
        color: copied ? "var(--signal)" : "var(--text-dim)",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        transition: "color .2s var(--ease)",
        flexShrink: 0,
      }}
    >
      {taskKey}
    </button>
  );
}

// ── Input + Label ────────────────────────────────────────────────────────────
export function Label({ className = "", children, ...props }) {
  return (
    <label className={`input-label ${className}`.trim()} {...props}>
      {children}
    </label>
  );
}

export function Input({ as = "input", className = "", ...props }) {
  const cls = `input-field ${as === "textarea" ? "textarea-field" : ""} ${className}`.trim();
  if (as === "textarea") return <textarea className={cls} {...props} />;
  return <input className={cls} {...props} />;
}

export function Field({ label, error, children }) {
  return (
    <div className="input-group">
      {label && <Label>{label}</Label>}
      {children}
      {error && <span className="input-error">{error}</span>}
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name = "", size = 28, tone = "brass" }) {
  const bg =
    tone === "brass"
      ? "linear-gradient(135deg, var(--brass), color-mix(in srgb, var(--brass) 70%, #000))"
      : "var(--panel-hi)";
  const color = tone === "brass" ? "var(--signal-ink)" : "var(--text-soft)";
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: bg,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontSize: Math.round(size * 0.4),
        fontWeight: 600,
        border: tone === "brass" ? "none" : "1px solid var(--border-hi)",
      }}
    >
      {(name || "U")[0].toUpperCase()}
    </span>
  );
}

// ── Kbd ──────────────────────────────────────────────────────────────────────
export function Kbd({ children }) {
  return (
    <kbd
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.68rem",
        background: "var(--panel)",
        border: "1px solid var(--border-hi)",
        borderRadius: 4,
        padding: "2px 6px",
        color: "var(--text-dim)",
      }}
    >
      {children}
    </kbd>
  );
}

// ── SectionLabel — mono eyebrow with a trailing hairline rule (preview motif) ──
export function SectionLabel({ children, className = "" }) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: "0.68rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-dim)",
        margin: "0 0 14px",
      }}
    >
      {children}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ width = "100%", height = 14, radius, style }) {
  return (
    <span
      className="skeleton"
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius ?? "var(--r-sm)",
        ...style,
      }}
    />
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
// Empty states are features: warmth, context, one primary action (DESIGN principle #1)
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <span style={{ color: "var(--text-dim)" }}>{icon}</span>}
      {title && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          {title}
        </span>
      )}
      {description && (
        <span
          style={{
            fontSize: "0.83rem",
            color: "var(--text-dim)",
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {description}
        </span>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = "md" }) {
  const cls = size === "sm" ? "spinner spinner-sm" : size === "lg" ? "spinner spinner-lg" : "spinner";
  return <span className={cls} />;
}

// ── InlineError / InlineSuccess (token-driven, mono) ──────────────────────────
export function InlineError({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        background: "var(--danger-soft)",
        border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--danger)",
        letterSpacing: 0.4,
        lineHeight: 1.5,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
      <span>{message}</span>
    </div>
  );
}

export function InlineSuccess({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        background: "var(--signal-soft)",
        border: "1px solid var(--signal-line)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--signal)",
        letterSpacing: 0.4,
        lineHeight: 1.5,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>✓</span>
      <span>{message}</span>
    </div>
  );
}

export default {
  Button,
  IconButton,
  Card,
  Badge,
  DueDateBadge,
  TaskKeyBadge,
  Label,
  Input,
  Field,
  Avatar,
  Kbd,
  SectionLabel,
  Skeleton,
  EmptyState,
  Spinner,
  InlineError,
  InlineSuccess,
};
