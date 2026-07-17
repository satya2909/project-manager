// backend/src/workers/dod.worker.js
//
// Phase 4 — the real agentic pipeline replaces the Phase 3.5 stub. Every
// node is (state) => Promise<state> (plans/PRD_v2.md §7.0); nodes 1-11 run
// in order, and Node 12 (persist) always runs regardless of how the run
// ended, so no run — completed, skipped, or fail-open — leaves a task
// locked (§7.3).

import { dodQueue } from "../queue/dod-queue-instance.js";
import { persistEvaluation } from "../services/dod-persist.js";
import { createRunState } from "../dod/state.js";
import { runPipeline } from "../dod/pipeline.js";
import { resolveContext } from "../dod/nodes/01-resolve-context.js";
import { checkBudget } from "../dod/nodes/02-check-budget.js";
import { pinCommit } from "../dod/nodes/03-pin-commit.js";
import { loadOrDecomposeRequirements } from "../dod/nodes/04-requirements.js";
import { fetchDiff } from "../dod/nodes/05-fetch-diff.js";
import { searchRepo } from "../dod/nodes/06-search-repo.js";
import { readFiles } from "../dod/nodes/07-read-files.js";
import { extractEvidence } from "../dod/nodes/08-extract-evidence.js";
import { verifyCitations } from "../dod/nodes/09-verify-citations.js";
import { tally } from "../dod/nodes/10-tally.js";
import { critique } from "../dod/nodes/11-critique.js";
import { persist } from "../dod/nodes/12-persist.js";

const DOD_PIPELINE_NODES = [
  resolveContext,
  checkBudget,
  pinCommit,
  loadOrDecomposeRequirements,
  fetchDiff,
  searchRepo,
  readFiles,
  extractEvidence,
  verifyCitations,
  tally,
  critique,
];

dodQueue.onProcess(async ({ payload }) => {
  const initialState = createRunState({
    runId: `${payload.taskId}:${payload.evaluationSeq}`,
    trigger: payload.trigger,
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    taskId: payload.taskId,
    evaluationSeq: payload.evaluationSeq,
    repo: payload.repo,
  });

  await runPipeline(DOD_PIPELINE_NODES, persist, initialState);
});

// A BullMQ job's final-attempt-exhausted event, in this in-process stand-in.
// Closes the exact gap found in /plan-ceo-review: without this handler, a
// job that fails all attempts inside an earlier node never reaches
// persistEvaluation, leaving the task stuck 'pending' forever. This only
// fires if the pipeline itself throws past every node's own try/catch (a
// bug, not a modeled failure) — the modeled failures (LLM timeout, GitHub
// 5xx, quota) all resolve via each node's own fail-open exit and never
// reach here.
dodQueue.onFinalFailure(async ({ payload }) => {
  await persistEvaluation({
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    taskId: payload.taskId,
    evaluationSeq: payload.evaluationSeq,
    headSha: payload.headSha,
    trigger: payload.trigger,
    verdict: {
      status: "PASSED_BY_SYSTEM_ERROR",
      evaluation: null,
      errorCode: "JOB_EXHAUSTED",
    },
  });
});
