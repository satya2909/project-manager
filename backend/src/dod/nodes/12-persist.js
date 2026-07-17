// Node 12 — persist (deterministic, the fenced write). Always runs,
// regardless of how the run ended — completed, skipped, or fail-open
// (plans/PRD_v2.md §7.2, §5.6). Builds the verdict handed to the shared
// fenced-write implementation from either an early `state.exit` or the
// accumulated pipeline state.

import { persistEvaluation } from "../../services/dod-persist.js";

export async function persist(state) {
  const verdict = state.exit
    ? { status: state.exit.status, errorCode: state.exit.errorCode, evaluation: null }
    : {
        status: "COMPLETED",
        evaluation: state.verdict?.evaluation ?? null,
        requirementsTotal: state.verdict?.requirementsTotal ?? 0,
        requirementsMet: state.verdict?.requirementsMet ?? 0,
        findings: state.findings,
        confidence: state.verdict?.confidence ?? null,
        critique: state.verdict?.critique ?? "",
        promptVersion: state.promptVersion ?? "v0-stub",
        model: state.model ?? "stub",
        tokensUsed: state.budget.tokensUsed,
        durationMs: Date.now() - state.budget.startedAt,
        strippedPaths: state.diff.strippedPaths,
        searchDegraded: state.searchDegraded,
        injectionPatternDetected: state.injectionPatternDetected,
      };

  await persistEvaluation({
    organizationId: state.organizationId,
    projectId: state.projectId,
    taskId: state.taskId,
    evaluationSeq: state.evaluationSeq,
    headSha: state.pinnedSha ?? state.repo.headSha,
    trigger: state.trigger,
    verdict,
  });

  return state;
}
