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

// `undefined` means "leave aiLockStatus untouched" — a genuine SKIPPED
// verdict (no active requirements, AI disabled, empty diff, etc.) is not an
// infrastructure failure and must not read the same as a real APPROVED/
// CLEAR result (plans/PRD_v2.md §7.3).
function nextLockStatus(verdict) {
  if (verdict.status === "SKIPPED") return undefined;
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
  const lockStatus = nextLockStatus(verdict);
  const setFields = { lastAppliedSeq: evaluationSeq };
  if (lockStatus !== undefined) setFields.aiLockStatus = lockStatus;

  const res = await Task.updateOne(
    { _id: taskId, lastAppliedSeq: { $lt: evaluationSeq } },
    { $set: setFields },
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
    findings: applied ? (verdict.findings ?? []) : [],
    confidence: applied ? (verdict.confidence ?? null) : null,
    critique: applied ? (verdict.critique ?? "") : "",
    promptVersion: applied ? (verdict.promptVersion ?? "v0-stub") : "v0-stub",
    model: verdict.model ?? "stub",
    tokensUsed: applied ? (verdict.tokensUsed ?? 0) : 0,
    durationMs: applied ? (verdict.durationMs ?? 0) : 0,
    strippedPaths: applied ? (verdict.strippedPaths ?? []) : [],
    searchDegraded: applied ? Boolean(verdict.searchDegraded) : false,
    injectionPatternDetected: applied ? Boolean(verdict.injectionPatternDetected) : false,
    errorCode: applied ? (verdict.errorCode ?? null) : "STALE_SEQ",
  });

  return { applied };
}
