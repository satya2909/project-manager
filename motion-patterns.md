# Project Camp — Framer Motion Patterns
Companion to `DESIGN.md` §6 (Motion). These are drop-in `framer-motion` implementations of
each motion moment in the preview, written against your actual component names
(`KanbanBoard.jsx`, `TaskCard.jsx`, `AuthLayout.jsx`, `AppShell`) so Claude Code can wire them
in directly instead of re-deriving them from the CSS preview.

Shared easing — put this once in a `motion/tokens.js` and import everywhere instead of
hand-typing cubic-beziers in each component:

```js
// frontend/motion/tokens.js
export const EASE = [0.16, 1, 0.3, 1];       // the "quality" curve — 95% of transitions
export const EASE_OUT = [0.22, 1, 0.36, 1];  // snappier — toggles, quick confirmations

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const stagger = (delay = 0.05) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});
```

---

## 1. Page load — staggered shell reveal

Replace ad-hoc `animate-fade-up delay-N` CSS classes with a single `motion` tree so the
stagger is declared once, not re-timed by hand per element.

```jsx
// AppShell.jsx (or DashboardPage.jsx wrapper)
import { motion } from "framer-motion";
import { fadeUp, stagger } from "../motion/tokens";

<motion.div variants={stagger(0.06)} initial="hidden" animate="show">
  <motion.aside variants={fadeUp} className="sidebar">…</motion.aside>
  <motion.div variants={fadeUp} className="topbar">…</motion.div>
  <motion.div variants={stagger(0.04)} className="stats">
    {stats.map(s => <motion.div key={s.id} variants={fadeUp} className="stat">…</motion.div>)}
  </motion.div>
  <motion.div variants={stagger(0.04)} className="projects">
    {projects.map(p => <motion.div key={p._id} variants={fadeUp} className="pcard">…</motion.div>)}
  </motion.div>
</motion.div>
```

Nested `stagger()` containers compose — the outer stagger sequences sidebar → topbar → stats
→ cards, and each inner stagger sequences the items *within* that block. This is the one
orchestrated entrance from DESIGN.md §6 — it should only run once per mount, not on every
re-render (React key stability on the outer wrapper handles that for free).

---

## 2. Project / task card hover — lift + corner brackets

```jsx
// ProjectCard.jsx
<motion.div
  className="pcard"
  whileHover={{ y: -3 }}
  transition={{ duration: 0.3, ease: EASE }}
>
  <BracketCorners />  {/* opacity handled by CSS :hover — no need to animate via JS */}
  …
</motion.div>
```

Keep the corner-bracket opacity fade as a plain CSS `:hover` transition (as in the preview) —
it's purely decorative and doesn't need JS-driven state. Only the `y` lift needs
`framer-motion`, since it should feel springier than a linear CSS transition.

---

## 3. Kanban — replace manual drag styling with `layout`

Your current `TaskCard.jsx` already animates `rotate`/`scale`/`boxShadow` on `isDragging` by
hand inside `motion.div`. Two upgrades:

**a) Add `layout` so cards reflow smoothly** when a sibling is added/removed/reordered —
this is what makes column drops feel like the board is *rearranging* rather than
snapping:

```jsx
// TaskCard.jsx
<motion.div
  layout
  layoutId={task._id}
  ref={setNodeRef}
  style={style}
  {...attributes}
  {...listeners}
  animate={{
    rotate: isDragging ? 2 : 0,
    scale: isDragging ? 1.04 : 1,
    boxShadow: isDragging
      ? "0 16px 40px rgba(0,0,0,.6), 0 0 20px var(--signal-line)"
      : isMine
        ? "0 2px 8px rgba(0,0,0,.3), -3px 0 0 var(--signal)"
        : "0 2px 8px rgba(0,0,0,.3)",
    zIndex: isDragging ? 50 : 1,
  }}
  transition={{ duration: 0.15, layout: { duration: 0.35, ease: EASE } }}
>
```

**b) Column counters roll up on change** instead of jumping — small but this is exactly the
kind of micro-detail that reads as "quality":

```jsx
// KanbanColumn.jsx
import { motion, AnimatePresence } from "framer-motion";

<span style={colStyles.headerCount}>
  <AnimatePresence mode="popLayout" initial={false}>
    <motion.span
      key={count}
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 8, opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      {String(count).padStart(2, "0")}
    </motion.span>
  </AnimatePresence>
</span>
```

**c) Checkbox / status morph** — if you add a quick-complete checkbox to `TaskCard` (as in the
preview), animate the tick draw rather than toggling a static SVG:

```jsx
<motion.svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
  <motion.path
    d="M20 6L9 17l-5-5"
    initial={false}
    animate={{ pathLength: task.status === "done" ? 1 : 0, opacity: task.status === "done" ? 1 : 0 }}
    transition={{ duration: 0.25, ease: EASE_OUT }}
  />
</motion.svg>
```

Note: keep the existing `isDragging` ref-guard sync pattern from the Kanban race-condition fix
untouched — `layout` animation is purely visual and doesn't affect the state-sync logic that
was the actual bug.

---

## 4. Command palette (⌘K) — if/when you build one

```jsx
// CommandPalette.jsx
<AnimatePresence>
  {open && (
    <>
      <motion.div
        className="palette-veil"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        onClick={onClose}
      />
      <motion.div
        className="palette"
        initial={{ opacity: 0, scale: 0.98, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -8 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        …
      </motion.div>
    </>
  )}
</AnimatePresence>
```

`AnimatePresence` is required here (not just `motion.div`) because the palette unmounts —
without it the exit animation is skipped entirely and it just vanishes.

---

## 5. Toast

```jsx
// Toast.jsx
<AnimatePresence>
  {toast && (
    <motion.div
      className="toast"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {toast.message}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 6. Theme toggle cross-fade

Framer Motion doesn't need to touch this — CSS custom-property transitions (as in the
preview's `body, .sidebar, .stat { transition: background .4s var(--ease), … }`) handle the
cross-fade more cheaply than animating it in JS. Only animate the toggle knob itself:

```jsx
<motion.span
  className="knob"
  animate={{ x: theme === "light" ? 24 : 2 }}
  transition={{ duration: 0.35, ease: EASE_OUT }}
/>
```

---

## 7. Reduced motion — one switch for the whole app

`framer-motion` has a built-in escape hatch — wrap the app root once instead of guarding
every component:

```jsx
// App.jsx
import { MotionConfig } from "framer-motion";

<MotionConfig reducedMotion="user">
  <AppRouter />
</MotionConfig>
```

This automatically respects `prefers-reduced-motion` for every `motion.*` component in the
tree — no per-component `useReducedMotion()` checks needed. Combine with the CSS-side
`@media (prefers-reduced-motion: reduce)` block from the preview for non-framer-motion CSS
transitions (hover states, corner brackets), and reduced motion is covered everywhere.

---

## Where NOT to reach for Framer Motion

Per DESIGN.md §8 — motion marks state change, not ambience. Don't wrap something in `motion.*`
just because it's available:
- Static hover lifts/border-brightens on cards → plain CSS `:hover` transition is cheaper and
  identical visually (see §2).
- Corner bracket reveal → CSS opacity transition, no JS state needed.
- Anything at rest (no idle pulsing `animate` loops) — if a `motion.div` has no trigger
  changing its `animate` prop, it shouldn't be a `motion.div`.
