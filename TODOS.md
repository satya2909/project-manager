# TODOS

Deferred work tracked across CEO/eng plan reviews. Each item names its source and why it was deferred (not just what it is).

## Timeline feature (from `/plan-ceo-review` on 2026-07-15, `plans/timeline-feature-plan.md`)

- **Bulk reschedule** — multi-select tasks on the timeline, shift dates by N days in one action.
  Deferred: needs the single-task drag-to-reschedule (Phase 4 of the timeline plan) proven in
  real use first; building multi-select before anyone's used the single-task version is premature.
- **ICS/calendar export** — export a project's scheduled tasks (`startDate`/`dueDate`) as a
  `.ics` file so due dates surface in Google Calendar/Outlook. Deferred: genuinely independent
  of the timeline UI (only needs the date fields to exist on `Task`), good standalone fast-follow,
  didn't need to ride along with the harder timeline visualization work.

## Pre-existing gap (found during `/plan-eng-review` on Phase 4-7, 2026-07-15)

- **`ProjectPage.jsx`'s `TasksTab.canManage` doesn't account for org owner/admin effective
  project access.** It's computed purely from `project.members` — `["admin","project_admin"].includes(myMembership?.role)`
  — but per CLAUDE.md, org owners/admins get effective project-ADMIN on every project in their
  org even when they're not a listed member (`attachProject`'s `isOrgManager` branch). An org
  owner who isn't a project member currently can't see the "+ New task" button (Table view),
  can't create via KanbanBoard (`canCreate={canManage}`), and — as of this review — can't
  interact with the Timeline's drag/resize/link/create affordances either, even though the
  backend would correctly allow all of it. Deferred: pre-existing in 2 places already (Table,
  Kanban) before Timeline reused the same variable for a 3rd; fixing it project-wide (compute
  `canManage` from `isOrgOwner || isOrgAdmin || project-role` once, reuse everywhere) is a
  separate, focused fix, not something to patch piecemeal inside a Timeline-scoped review.
