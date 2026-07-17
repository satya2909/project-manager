// backend/src/services/dod-persist.js
//
// Phase 3.4 / Node 12 (plans/ai-dod-plan.md, plans/PRD_v2.md §5.6) — the
// fenced conditional write. Three rapid pushes produce three workers; LLM
// latency is unpredictable, so completion order is not issue order. Without
// this fence, a stale REJECTED could land after a fresh APPROVED and block a
// task that's already fixed — the exact shape of the Kanban race condition,
// paid for once already.
//
// Always writes an AiEvaluationLog, even when the Task write is discarded as
// stale — the log is the debugging surface (PRD §5.6).

import { Task, AiEvaluationLog } from "../models/index.js";

function nextLockStatus(verdict) {
  if (verdict.status !== "COMPLETED") return "clear"; // fail-open, always
  return verdict.evaluation === "APPROVED" ? "clear" : "blocked";
}

export async function persistEvaluation({
  organizationId,
  projectId,
  taskId,
  evaluationSeq,
  headSha,
  trigger,
  verdict,
}) {
  const res = await Task.updateOne(
    { _id: taskId, lastAppliedSeq: { $lt: evaluationSeq } },
    { $set: { aiLockStatus: nextLockStatus(verdict), lastAppliedSeq: evaluationSeq } },
  );
  const applied = res.matchedCount > 0;

  await AiEvaluationLog.create({
    organization: organizationId,
    project: projectId,
    task: taskId,
    evaluationSeq,
    headSha,
    trigger,
    status: applied ? verdict.status : "SKIPPED",
    evaluation: applied ? (verdict.evaluation ?? null) : null,
    requirementsTotal: applied ? (verdict.requirementsTotal ?? 0) : 0,
    requirementsMet: applied ? (verdict.requirementsMet ?? 0) : 0,
    model: verdict.model ?? "stub",
    errorCode: applied ? (verdict.errorCode ?? null) : "STALE_SEQ",
  });

  return { applied };
}
