# Project Camp — Frontend Redesign Plan
**Companion to `DESIGN.md`, `motion-patterns.md`, `design-preview-v2.html`.**
Direction: "Precision Terminal" · dark + light · foundation-first sequencing.

This plan turns the design *system* (which is ~complete) into an executable *redesign*
of the actual React app. It fills the decisions the design docs left open (auth, modals,
org, empty/error/loading states, responsive, ⌘K + toast behavior) and names the one
migration hazard the docs assume away.

Scope confirmed: **theme toggle, ⌘K command palette, and toast system are all in scope**
(net-new features, not just restyling).

---

## The core hazard (read first)

`DESIGN.md §7` claims *"All component CSS reads only CSS custom properties — zero
hardcoded colors — so the same rule set repaints under either theme."* **False today.**
The app is built from **inline style objects** (`const S = {…}`) with hardcoded colors:
`AppShell.jsx` uses `rgba(0,255,65,…)` (an older, brighter green than the current
`--phosphor` `#00d97e`) in ~15 places, plus hardcoded `boxShadow` glows. A `data-theme`
attribute repaints index.css `.btn`/`.card` classes but **not** inline `rgba()`.

→ **Light mode cannot work until inline hardcoded colors become tokens.** This is
Phase 0/1 work, not a nice-to-have. Every phase below has a "tokenize" step for the
components it touches. Definition of done for the whole redesign includes:
`grep -rE "rgba\(|#[0-9a-fA-F]{3,6}" frontend/{components,pages,App.jsx}` returns only
token definitions, never literal colors in component code.

---

## Legacy atmosphere to remove (the "v1 hacker cosplay" DESIGN.md §2/§8 rejects)

These exist today and must go — they're "animate at rest" / "mono-as-UI-voice" violations:

- `index.css` `body::before` **noise overlay** and `body::after` **scanlines** → delete.
- `AppShell` **SignalBars** (5 looping bars), **blinking topbar cursor** `▮`,
  **"SYSTEM ONLINE"** status, pulsing **statusDot**, the **live clock** → delete or replace.
- `App.jsx` **BootScreen** "INITIALIZING…" with infinite opacity pulse → redesign (below).
- `.notif-dot` `pulse-signal` idle animation, `.cursor-blink` → remove idle loops.
- `font-mono` as the default UI voice (AppShell sets `fontFamily: var(--font-mono)` on
  root and every label) → mono becomes **data-only** per DESIGN.md §4.
- The blue `--ice` accent used for admin badges → replace with `--brass` (no 2nd accent, §8).

---

## Phase 0 — Token & type foundation
**Files:** `frontend/index.css`
**Goal:** index.css becomes a 1:1 match of DESIGN.md token tables, both themes, new fonts.

1. Swap font import: `Bricolage Grotesque` (display), `Hanken Grotesk` (sans/UI),
   `IBM Plex Mono` (mono/data). Remove Geist / Share Tech Mono / JetBrains Mono.
   Update `--font-display`, `--font-sans`, `--font-mono`.
2. Replace `:root` dark tokens with DESIGN.md §3 "Void console" values exactly
   (`--bg #0a0b0c` … `--signal #00e08f`, `--brass #cf9d5c`, `--danger #e8615a`,
   plus `--signal-ink`, `--signal-soft`, `--signal-line`, `--brass-soft`, `--danger-soft`).
3. Add `html[data-theme="light"]` block with §3 "Drafting table" values
   (`--bg #f2f3ef` … `--signal #007a52`, `--brass #93650f`, `--danger #c8362d`).
   Include the light-mode body radial-gradient and softened shadows from the preview.
4. Radius scale → DESIGN.md §5: `--r-xs 2px / --r-sm 3px / --r-md 5px / --r-lg 8px`.
   (Current app goes up to `--r-2xl 20px`; cap at 8px per §8 "don't round past --r-lg".)
5. Add the two easing curves as tokens: `--ease: cubic-bezier(.16,1,.3,1)`,
   `--ease-out: cubic-bezier(.22,1,.36,1)`.
6. Add the cross-fade transition rule (preview): `body, .sidebar, .topbar, .stat, .pcard,
   .col, .task, .toast, .palette { transition: background .4s var(--ease), border-color
   .4s, color .3s, box-shadow .4s; }` so theme switches never hard-cut.
7. Delete noise/scanline overlays; keep `@media (prefers-reduced-motion: reduce)`.
8. Rewrite `.btn-primary` to flat `--signal` fill (no gradient, no glow shadow) per §5
   "no glow-as-elevation." Same for `.card`, `.task-card`, `.kanban-column`, `.badge-*`,
   `.input-field`, `.nav-item` — flat fills, hairline borders, hover = translateY + border
   brighten + soft shadow, never glow.

**Checkpoint:** app renders in new palette + fonts, dark only, nothing looks glowy.
Inline-styled components will still be wrong-colored — expected; fixed per-phase next.

---

## Phase 1 — Motion tokens, theme infra, shared primitives
**Files:** `frontend/motion/tokens.js` (new), `frontend/context/theme.jsx` (new),
`frontend/components/ui/primitive.jsx`, `frontend/main.jsx` / `App.jsx`

1. **`motion/tokens.js`** — export `EASE`, `EASE_OUT`, `fadeUp`, `stagger()` exactly as
   `motion-patterns.md` header. Every component imports these instead of hand-typing curves.
2. **`MotionConfig reducedMotion="user"`** wrap at App root (`motion-patterns.md §7`).
3. **Theme context** — `data-theme` on `<html>`, `localStorage('pc-theme')`, fallback to
   `prefers-color-scheme`. Expose `useTheme() → { theme, toggle }`. Logic is the preview's
   IIFE, Reactified. Set the attribute **before first paint** (inline script in `index.html`
   or a `useLayoutEffect`) to avoid a dark→light flash on load in light mode.
4. **Theme toggle component** — physical sun/moon switch from the preview (`.theme-toggle`
   + knob), knob animated with Framer `animate={{ x: theme==='light' ? 24 : 2 }}` (§6 pattern).
5. **Shared primitives** (extend `primitive.jsx`) so screens don't re-invent:
   `Button` (primary/ghost/danger), `Card`, `Badge` (status + role), `Input`, `Label`,
   `Avatar`, `Kbd`, `SectionLabel` (the mono eyebrow + rule), `EmptyState`, `Skeleton`,
   `IconButton`. All className-based (reading tokens), zero hardcoded colors.

**Design decision — reduced motion:** `MotionConfig` covers `motion.*`; the CSS
`@media prefers-reduced-motion` covers hover/bracket transitions. Both required (§7).

---

## Phase 2 — App shell (sidebar + topbar)
**Files:** `AppShell.jsx`

1. **Tokenize:** replace every inline `rgba(0,255,65,…)` / hex / glow with tokens or
   className. This is the biggest single tokenization job in the app.
2. Sidebar: brand mark (`--signal` square with inset), mono `WORKSPACE` group label,
   nav items in **Hanken Grotesk** (not mono), mono count chips only.
3. **Nav sliding pill** (preview): single `.nav-pill` element that `translateY`s to the
   active item, Framer `layout` or transform on active change. Replaces the current
   per-item `activeBar` + scanSweep.
4. Topbar: real breadcrumb (`Workspace / **Dashboard**`), ⌘K trigger (Phase 6),
   theme toggle (Phase 1). **Remove** "SYSTEM ONLINE", statusDot pulse, blink cursor, clock.
5. Sidebar foot: avatar (brass gradient) + name (sans) + role (mono). Keep two-step logout
   but restyle to ghost→danger, no glow.
6. **Page-load choreography:** wrap shell in `stagger(0.06)` → sidebar → topbar → content,
   using `fadeUp` variant (`motion-patterns.md §1`). One orchestrated entrance, runs once.

**Design decision — MISSING FROM DOCS — mobile nav:** below `768px`, sidebar collapses
to an off-canvas drawer opened by a hamburger in the topbar; overlay veil; nav items get
44px min touch height; drawer slides in with `EASE`, veil fades. Desktop collapse-to-56px
rail stays for ≥768px.

---

## Phase 3 — Dashboard
**Files:** `DashboardPage.jsx`

1. Page head: `Good afternoon, {name}` in Bricolage 1.7rem/600, sub in `--text-dim`,
   primary "New project" button (manager-gated as today).
2. **Stat row** (4 cards): mono uppercase label, Bricolage 2.1rem value, delta line.
   Cursor-tracked radial **spotlight** (opacity-only, `--mx/--my`, preview JS) — the one
   allowed "responds to cursor" flourish, zero layout shift. Number **roll-up** on mount
   (rAF ease-out cubic, preview `rollUp`), respect reduced-motion (show final value).
3. **Project cards** grid: icon tile, status pill (signal/brass/neutral), Bricolage name,
   meta, progress bar (fills from 0 on mount, `width 1.1s var(--ease)`), avatar stack,
   task count. Hover: `translateY(-3px)` + border brighten + **corner-bracket reveal**
   (§5 signature — 4 ticks in `--signal-line`, opacity fade, hover-only, CSS not JS).
4. `motion-patterns.md §2` for the card lift; brackets stay CSS `:hover`.

**Design decisions — MISSING FROM DOCS — empty & loading states:**
- **No projects yet** (new org): centered `EmptyState` — Bricolage line "No projects yet",
  one sentence of context, single primary "Create your first project" CTA. Warm, not
  "0 results". (Design principle #1.)
- **Loading:** stat + project-card **skeletons** in the new `Skeleton` primitive (flat
  shimmer, token colors), matching final layout dimensions to avoid shift.
- **Member sees no projects** (has org access but assigned none): distinct copy —
  "No projects assigned to you yet. Ask an admin to add you to a project." (no create CTA).

---

## Phase 4 — Kanban board
**Files:** `ProjectPage.jsx`, `KanbanBoard.jsx`, `TaskCard.jsx`, new `KanbanColumn.jsx`

1. Board head, columns (surface, hairline, status dot + label + mono count).
2. **Task cards** tokenized; `isMine` accent = left `--signal` bar (keep). Hover lift.
3. **`layout` + `layoutId`** on TaskCard so reflow on add/remove/reorder animates
   (`motion-patterns.md §3a`). **Preserve the existing `isDragging` ref-guard sync** — the
   race-condition fix — untouched; `layout` is visual only (§3 note).
4. **Column counters roll** on change via `AnimatePresence mode="popLayout"` (§3b).
5. **Quick-complete checkbox** on cards: spring-scale morph + tick `pathLength` draw (§3c),
   `EASE_OUT`.
6. Drop-target styling: border → `--signal`, faint `--signal-soft` fill (no glow).

**Design decisions — MISSING FROM DOCS:**
- **Empty column** = dashed hairline box, mono "No tasks", `--muted` (preview has this).
- **Empty board** (project with zero tasks in all columns): single empty state above the
  board with "Add your first task" CTA.
- **Drag on touch:** respect the existing sensor thresholds; ensure cards are ≥44px tall.

---

## Phase 5 — Modals & drawers
**Files:** `CreateProjectModal.jsx`, `CreateTaskModal.jsx`, `TaskDetailDrawer.jsx`,
`MembersPanel.jsx`, `OrgMembersPanel.jsx`

1. Tokenize all; forms use the `Input`/`Label` primitives, mono labels, sans inputs.
2. **Modal motion** (MISSING FROM DOCS — derive from palette pattern §4): veil
   `opacity 0→1` + `backdrop-filter blur(3px)`; panel `scale .98→1, y -8→0`, `EASE`,
   250–320ms; `AnimatePresence` so exit plays. Focus-trap + `Esc` to close + return focus.
3. **Drawer** (TaskDetailDrawer): slide from right `x: 100%→0` with `EASE`, veil fade.
4. Modal radius `--r-lg` (8px), flat panel, soft shadow — never glow border.

**Design decision — form error/success states:** inline field errors in `--danger` mono
below the field; submit button shows spinner + disables; success closes modal and fires a
**toast** (Phase 6). Validation mirrors backend `express-validator` messages.

---

## Phase 6 — Command palette (⌘K) + Toast  *(net-new)*
**Files:** `CommandPalette.jsx` (new), `Toast.jsx` + `ToastProvider` (new)

**⌘K palette** — build real, not the static preview:
1. Global `⌘K`/`Ctrl+K` listener (already sketched in preview JS) + topbar trigger.
2. Motion: veil blur-in + panel `scale .98→1, y -8→0` via `AnimatePresence`
   (`motion-patterns.md §4`).
3. **Data source (DECISION):** searches loaded `projects`, the user's tasks
   (`GET /tasks/me`), and static actions (New project, Invite teammate, Go to Dashboard/
   My Tasks/Organization). Client-side fuzzy filter; no new backend endpoint needed for v1.
4. **Keyboard nav (DECISION):** ↑/↓ move selection, `Enter` activates, `Esc` closes,
   selection wraps, mouse hover syncs selection. Results grouped (Projects / Tasks /
   Actions) with mono group labels.
5. **Empty search state:** "No matches for '{q}'" in `--text-dim`, plus a "Create project
   '{q}'" action when query is non-empty.

**Toast** — `ToastProvider` + `useToast()`:
1. API: `toast(message, { kind: 'success'|'info'|'danger', duration=2600 })`.
2. Motion: `y 16→0, scale .97→1`, spring-ish `EASE`, auto-dismiss ~2.6s
   (`motion-patterns.md §5`). Bottom-right stack, `AnimatePresence` for exit.
3. Wire into: project create/delete, task create/update/delete, invite send, member
   role change, org update, copy-invite-link.
4. **A11y:** `role="status"` `aria-live="polite"`; reduced-motion → fade only.

---

## Phase 7 — Auth pages  *(entirely uncovered by docs)*
**Files:** `AuthLayout.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `ForgotPasswordPage.jsx`,
`ResetPasswordPage.jsx`, `VerifyEmailPage.jsx`, `AcceptInvitePage.jsx`

**Design decision — auth visual language (NEW):** the auth screens are the first
impression, so they carry a bit more of the "instrument" identity than the app interior:
- Centered card on `--bg` with the light/dark radial-gradient wash; card = `--surface`,
  hairline, `--r-lg`, soft shadow. Brand mark + "project**camp**" wordmark top.
- Title in Bricolage 600; labels mono uppercase; inputs sans; primary button `--signal`.
- One orchestrated `fadeUp` stagger on mount; page-to-page uses existing `AnimatePresence`
  `fadeSlide` in `AuthRouter` (retune to `EASE`).
- Theme toggle present in a top corner (so preference is set before login).
- **AcceptInvitePage**: show org name + inviter + role prominently (trust — design
  principle #9); the invite is the user's first contact with the product.
- **VerifyEmail / Reset**: explicit success, error (expired/invalid token), and loading
  states — three states each, not just the happy path.

**BootScreen redesign** (`App.jsx`): replace "INITIALIZING…" terminal boot with a calm
brand mark + single subtle `fadeUp`; no infinite pulse (violates "no animate at rest").
Or a bare centered brand mark with a 1px indeterminate bar. Keep it under ~1s perceived.

---

## Phase 8 — Organization & My Tasks pages
**Files:** `OrganizationPage.jsx`, `MyTasksPage.jsx`

1. **OrganizationPage** tabs (Settings / Members / Invites): tab bar with the **nav-pill**
   pattern reused (sliding underline/pill), `AnimatePresence` on tab content.
   - Members table: avatar + name + email (sans) + role badge (mono) + row actions.
   - Invites: pending list, resend/revoke, bulk-invite upload affordance.
   - **Danger zone** (owner-only delete): visually separated, `--danger` framed, requires
     typed confirmation; explicit copy about what's irreversible.
2. **MyTasksPage:** self-scoped task list grouped by project or status; reuse TaskCard
   language in a list layout; empty state "No tasks assigned to you."

**Design decisions — empty states (all):** no members (solo org) → "Invite your team";
no pending invites → "No pending invites"; each warm + actionable, never bare "0 results".

---

## Phase 9 — States, responsive & a11y sweep (the "10/10" pass)
Cross-cutting, run after screens exist:

1. **Every screen's 4 states** verified present: loading (skeleton), empty (warm CTA),
   error (retry affordance + apology copy, design principle "when in doubt, apologize"),
   populated. Build a checklist per screen.
2. **Responsive:** breakpoints at `768px` (mobile) and `1180px` (content max-width).
   Stats 4→2→1 col; projects 3→2→1; board horizontal-scroll on mobile with snap; sidebar
   drawer (Phase 2). Test 320px width — no horizontal body scroll.
3. **A11y (MISSING FROM DOCS):** keyboard nav everywhere (⌘K, tab order, focus-visible
   rings in `--signal`), 44px touch targets, WCAG AA contrast (both themes already pass per
   DESIGN.md §3 — verify after tokenization), `aria-current`/`aria-live`/`role` on nav,
   toasts, modals. Screen-reader labels on icon-only buttons.
4. **Final tokenization grep** (definition of done): no literal colors in component code.
5. **Reduced-motion audit:** toggle OS setting, confirm every phase's motion collapses.

---

## Sequencing summary

| Phase | Unlocks | Risk |
|---|---|---|
| 0 Tokens/fonts | everything | low |
| 1 Motion+theme+primitives | theme toggle, consistency | med (theme flash) |
| 2 App shell | tokenization proof, nav, mobile | **high (biggest inline migration)** |
| 3 Dashboard | stat/card language | low |
| 4 Kanban | layout motion, preserve race-fix | med (don't break sync) |
| 5 Modals/drawers | forms, focus mgmt | low |
| 6 ⌘K + Toast | net-new features | med (keyboard/a11y) |
| 7 Auth | first impression | low |
| 8 Org/My Tasks | remaining screens | low |
| 9 States/responsive/a11y | ships-quality | med (scope discipline) |

**Build order rationale (foundation-first):** Phases 0–1 make every later phase a
className/token drop instead of bespoke inline work, and Phase 2 proves the tokenization
pattern on the hardest component before the rest inherit it.

---

## Open questions to resolve before/while building
1. **Assets:** you offered assets — do you have a real **brand mark/logo** to replace the
   placeholder `P` square, and are the three Google Fonts acceptable (vs self-hosting)?
2. **⌘K search scope v1:** projects + my tasks + actions (client-side) enough, or do you
   want full-text task search (needs a backend endpoint)?
3. **Light or dark as the *marketing* default** for brand-new visitors before they set a
   preference? DESIGN.md says dark is brand-forward; confirm that's the first-paint default.
4. **BootScreen:** keep a branded boot at all, or go straight to a skeleton of the shell?
