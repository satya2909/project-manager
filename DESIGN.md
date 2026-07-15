# Project Camp — Design System
**Direction: "Precision Terminal"** · v2 · dark + light

---

## 1. Purpose & audience

Project Camp is a multi-tenant project management SaaS sold to companies as a seat-based product — not a personal dev tool. The interface has to do two things at once, which is the whole design tension:

- **Read as trustworthy, premium B2B software** to a buyer evaluating it against Linear, Height, or Asana.
- **Keep the phosphor-terminal identity** that makes it memorable and not a template — but as a *disciplined accent*, not a costume.

The fix is restraint: same DNA (near-black surfaces, phosphor green, sharp geometry, monospace for data), spent on far fewer things, with real typographic and spatial polish carrying the "premium" weight instead of glow and gimmick.

---

## 2. Tone

**Operator console, not hacker cosplay.** Quiet, confident, technical. Motion and color are used to mark *state changes* (a task completing, a save happening), never as ambient decoration. If in doubt, remove the accessory.

---

## 3. Color

Two palettes sharing one structure: `bg → surface → surface-2 → panel → panel-hi`, four text steps, and three accents (signal / brass / danger). Only the **values** change between themes — variable names and their jobs are identical, which is what makes a toggle safe to build.

### Dark — "Void console" (default)

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0a0b0c` | App background |
| `--surface` | `#0f1112` | Cards, sidebar base |
| `--surface-2` | `#151718` | Hover surface, input fill |
| `--panel` | `#1a1c1e` | Task cards, palette |
| `--panel-hi` | `#202325` | Raised/hover panel |
| `--border` | `#232628` | Default hairline |
| `--border-hi` | `#2e3234` | Hover/focus hairline |
| `--text` | `#eceeef` | Primary text |
| `--text-soft` | `#a3a8ac` | Secondary text |
| `--text-dim` | `#6c7276` | Tertiary / labels |
| `--muted` | `#484d50` | Disabled, placeholders |
| `--signal` | `#00e08f` | **The** accent — primary action, active state, success/done |
| `--brass` | `#cf9d5c` | Secondary accent — "in progress," warnings, warm hierarchy |
| `--danger` | `#e8615a` | Destructive, high priority |

### Light — "Drafting table"

Not an inverted dark theme — green and brass are both pulled darker and denser so they hold contrast on bright paper instead of looking washed out. Background is a cool-neutral paper (`#f2f3ef`), never stark white, to keep the technical/instrument feel.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#f2f3ef` | App background |
| `--surface` | `#fbfbf9` | Cards, sidebar base |
| `--surface-2` | `#f4f5f1` | Hover surface |
| `--panel` / `--panel-hi` | `#ffffff` | Task cards, palette |
| `--border` | `#dfe1da` | Default hairline |
| `--border-hi` | `#c9cdc2` | Hover/focus hairline |
| `--text` | `#14171a` | Primary text |
| `--text-soft` | `#4c5256` | Secondary text |
| `--text-dim` | `#7d8388` | Tertiary / labels |
| `--muted` | `#a9adaa` | Disabled, placeholders |
| `--signal` | `#007a52` | Primary action, active, done (darkened for AA contrast on white) |
| `--brass` | `#93650f` | Secondary accent |
| `--danger` | `#c8362d` | Destructive, high priority |

**Rule of thumb:** signal green may only be used for — the primary CTA, the active nav indicator, "done" states, and one metric per screen that's genuinely worth celebrating. If a fourth thing on screen wants to be green, it's competing with the ones that matter; make it brass or neutral instead.

Both palettes pass WCAG AA for body text (`--text` on `--bg`/`--surface`) and for `--signal`/`--brass`/`--danger` used as text on their own `-soft` background tints.

---

## 4. Typography

Three faces, three jobs — never interchangeable:

| Face | Role | Notes |
|---|---|---|
| **Bricolage Grotesque** | Display — page titles, card titles, stat values, brand | Variable weight 400–800. Distinctive ink-trap-adjacent letterforms; used at 600 weight almost everywhere for confidence without shouting. |
| **Hanken Grotesk** | UI & body — nav, buttons, descriptions, paragraphs | Humanist, warmer than a geometric grotesk, keeps the interface feeling made-for-people rather than made-for-machines. |
| **IBM Plex Mono** | Data only — IDs, timestamps, counts, tags, kbd hints | Reserved strictly for genuinely tabular/technical content. This is the biggest change from v1: mono is no longer the default UI voice. |

**Scale** (dark and light share the same scale):
- Display XL (page title): `1.7rem` / 600 / `-0.02em`
- Display MD (card/section title): `1.0–1.1rem` / 600
- Stat value: `2.1rem` / 600 / `-0.02em`
- Body: `0.83–0.86rem` / 400–500
- Label / eyebrow: `0.66–0.72rem` mono / `0.08–0.1em` tracking / uppercase

---

## 5. Shape, elevation, spacing

- **Radius:** small and consistent — `2px / 3px / 5px / 8px` (`--r-xs` → `--r-lg`). Never fully rounded except avatars and the toggle pill. Sharp-but-not-brutal.
- **Elevation:** real layering (`surface → panel → panel-hi`) plus soft shadows on hover (`0 10px 24px -12px rgba(0,0,0,.6)` dark / lighter neutral shadow on light). No glow-as-elevation.
- **The bracket signature:** the original `.brk2`/`.brk4` corner-bracket motif survives, but only as a **hover reveal** on project cards — four 10px corner ticks in signal-green that fade in at 35% opacity transition. This is the one place the old identity shows up decoratively; everywhere else it's earned through structure instead.
- **Spacing:** 4px base unit. Card padding 18px, section gaps 32–44px, generous negative space between major blocks rather than tight uniform padding everywhere.

---

## 6. Motion

Motion marks **change**, not ambience. Everything uses one of two easing curves:
- `--ease: cubic-bezier(.16,1,.3,1)` — the default "quality" curve, used for 95% of transitions
- `--ease-out: cubic-bezier(.22,1,.36,1)` — snappier, for toggle knobs and quick confirmations

| Moment | Treatment |
|---|---|
| Page load | Single staggered rise (`translateY(14px)→0`, opacity 0→1), 8 steps across sidebar → topbar → stats → cards → board, 0.04–0.06s apart. One orchestrated entrance, nothing re-animates after. |
| Card hover | `translateY(-2/-3px)` + border brighten + shadow, 250–350ms |
| Corner brackets | Opacity fade only, 350ms, hover-only |
| Checkbox / task done | Spring-scale morph (1 → 1.05 → 1) + tick draws in, 200–300ms |
| Stat panel | Cursor-tracked radial spotlight, opacity-only, zero layout shift |
| Command palette | Veil blur-in + panel scale from 98%→100%, 250–320ms |
| Toast | `translateY(16px)→0` with slight scale, spring-ish ease, auto-dismiss ~2.6s |
| Theme switch | Cross-fade on background/border/color, 300–450ms, so the toggle never feels like a hard cut |

`prefers-reduced-motion: reduce` collapses all animation/transition durations to near-zero globally — non-negotiable, not just on the marquee moments.

---

## 7. Dark/light toggle — implementation pattern

- Single `data-theme="light"` attribute on `<html>`; absence = dark (dark is the default/brand-forward state).
- All component CSS reads only CSS custom properties — zero hardcoded colors in component rules — so the same rule set repaints correctly under either theme.
- Persisted via `localStorage`, falling back to `prefers-color-scheme` on first visit.
- Toggle control is a physical switch (sun/moon knob), not a dropdown — one click, no menu, matches the "instrument" feel of the rest of the UI.

---

## 8. What NOT to do

- Don't let mono type creep back into UI copy, buttons, or nav — it's for data only.
- Don't add a second saturated accent competing with signal green — brass is the only other accent, and it's intentionally warm/muted, not a second bright color.
- Don't animate anything at rest (no idle pulses, no looping glows, no scanline sweeps). If it's not responding to an action, it doesn't move.
- Don't round corners past `--r-lg` (8px) outside of avatars — full pill shapes read as consumer-app, not operator-console.
- Don't use pure white (`#fff`) as a background in light mode — it flattens the depth system; `--bg` is warm-cool paper, only small raised elements (`panel`) go to true white.

---

## 9. Files

- `design-preview-v2.html` — interactive reference implementation (dark/light toggle, command palette, kanban interactions, dashboard). Open directly in a browser.
- This document is the source of truth when translating the preview into the real React component library — variable names here should map 1:1 to `frontend/index.css` custom properties.
