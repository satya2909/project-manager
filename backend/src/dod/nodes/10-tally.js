// Node 10 — tally (deterministic, no LLM). The verdict is arithmetic over
// findings, not a model's opinion. The model never reports a score — "3 of
// 4 requirements evidenced" is countable and defensible; a percentage
// implies a precision the system does not have (plans/PRD_v2.md §7.2 Node 10).
//
// Vacuous-approval guard: `met === total` is vacuously true at `total ===
// 0`. Without it, a project admin deactivating every requirement on a task
// (permitted by the Requirements editor) would auto-APPROVE with zero
// evidence — indistinguishable from genuine full verification. `aiLockStatus`
// stays unchanged on this SKIPPED, matching the rule for decomposition
// producing nothing (amended 2026-07-17, /plan-ceo-review).

export async function tally(state) {
  const total = state.requirements.length;

  if (total === 0) {
    state.exit = { status: "SKIPPED", errorCode: "NO_ACTIVE_REQUIREMENTS" };
    return state;
  }

  const met = state.findings.filter(
    (f) => f.status === "met" && f.citations.some((c) => c.verified),
  ).length;

  state.verdict = {
    evaluation: met === total ? "APPROVED" : "REJECTED",
    requirementsTotal: total,
    requirementsMet: met,
  };

  return state;
}
