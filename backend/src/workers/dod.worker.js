// backend/src/workers/dod.worker.js
//
// Phase 3.5 (plans/ai-dod-plan.md) — stub verdict, no LLM, no diff fetch.
// Proves the plumbing (tenancy, queue, debounce, fencing) in isolation from
// the LLM pipeline, which is Phase 4's job. Always resolves APPROVED.

import { dodQueue } from "../queue/dod-queue-instance.js";
import { persistEvaluation } from "../services/dod-persist.js";

dodQueue.onProcess(async ({ payload }) => {
  await persistEvaluation({
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    taskId: payload.taskId,
    evaluationSeq: payload.evaluationSeq,
    headSha: payload.headSha,
    trigger: payload.trigger,
    verdict: {
      status: "COMPLETED",
      evaluation: "APPROVED",
      requirementsTotal: 1,
      requirementsMet: 1,
      model: "stub",
    },
  });
});

// A BullMQ job's final-attempt-exhausted event, in this in-process stand-in.
// Closes the exact gap found in /plan-ceo-review: without this handler, a
// job that fails all attempts inside an earlier node never reaches
// persistEvaluation, leaving the task stuck 'pending' forever.
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
