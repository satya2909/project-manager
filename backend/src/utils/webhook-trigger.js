// backend/src/utils/webhook-trigger.js
//
// Phase 3.2b (plans/ai-dod-plan.md) / plans/PRD_v2.md §6.4 — decides which
// webhook deliveries actually trigger an evaluation. PR events only; push is
// never evaluated. This is an attention decision, not a cost one: a dev
// pushes 8-15x/day and every WIP rejection is accurate and worthless — the
// feature would spend its whole credibility budget on true-but-useless
// rejections before it ever says something that matters.

const EVALUATABLE_ACTIONS = ["opened", "ready_for_review", "synchronize", "reopened"];

export function shouldEvaluate(event, payload) {
  if (event !== "pull_request") return false;
  if (payload.pull_request?.draft) return false;

  // Fixed in /plan-ceo-review (2026-07-17): the original draft evaluated on
  // ANY 'edited' action, including body-only edits. Only the title carries
  // the task key, and only a title change can make a key newly appear.
  if (payload.action === "edited") {
    return Boolean(payload.changes?.title);
  }

  return EVALUATABLE_ACTIONS.includes(payload.action);
}
