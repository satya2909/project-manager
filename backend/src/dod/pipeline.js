// backend/src/dod/pipeline.js
//
// Runs the pipeline's nodes in order (plans/PRD_v2.md §7.0 — a linear state
// machine, no LangGraph). Any node can short-circuit the rest by setting
// `state.exit`; persist (Node 12) always runs regardless, so every run —
// completed, skipped, or aborted — leaves an AiEvaluationLog and never
// leaves a task locked by an infra failure (§7.3).

export async function runPipeline(nodes, persistNode, initialState) {
  let state = initialState;

  for (const node of nodes) {
    state = await node(state);

    if (state.exit) break;

    if (Date.now() - state.budget.startedAt > state.budget.wallCapMs) {
      state.exit = { status: "PASSED_BY_SYSTEM_ERROR", errorCode: "WALL_CLOCK_EXCEEDED" };
      break;
    }
  }

  state = await persistNode(state);
  return state;
}
