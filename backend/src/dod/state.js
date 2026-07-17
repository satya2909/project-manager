// backend/src/dod/state.js
//
// Run-state factory (plans/PRD_v2.md §7.1). Every node is (state) =>
// Promise<state> — the whole run is inspectable at every step, and any node
// can short-circuit the rest of the pipeline by setting `state.exit`.

const DEFAULT_TOKEN_CAP = 200_000;
const DEFAULT_WALL_CAP_MS = 180_000;

export function createRunState({
  runId,
  trigger,
  organizationId,
  projectId,
  taskId,
  evaluationSeq,
  repo,
}) {
  return {
    runId,
    trigger,
    organizationId,
    projectId,
    taskId,
    evaluationSeq,

    repo: {
      fullName: repo?.fullName ?? null,
      installationId: repo?.installationId ?? null,
      headSha: repo?.headSha ?? null,
      baseSha: repo?.baseSha ?? null,
      prNumber: repo?.prNumber ?? null,
    },

    // Populated by resolveContext (Node 1) — not part of the persisted log,
    // just in-run working data the later nodes need.
    task: null,
    project: null,
    orgAiSettings: null,

    requirements: [],
    diff: { text: "", files: [], strippedPaths: [], truncated: false },
    candidates: [],
    files: [],
    findings: [],
    verdict: null,

    budget: {
      tokenCap: DEFAULT_TOKEN_CAP,
      tokensUsed: 0,
      wallCapMs: DEFAULT_WALL_CAP_MS,
      startedAt: Date.now(),
      llmCalls: 0,
    },

    promptVersion: null,
    model: null,
    errors: [],
    searchDegraded: false,
    injectionPatternDetected: false,

    // Set by any node to short-circuit the remaining pipeline and jump
    // straight to persist (Node 12). `{ status, errorCode }` — status is one
    // of AiEvaluationLog's enum values ('SKIPPED' | 'PASSED_BY_SYSTEM_ERROR').
    exit: null,
  };
}
