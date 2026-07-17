import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User, Organization, Project, Task, AiEvaluationLog } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";
import { persistEvaluation } from "../src/services/dod-persist.js";

let orgCounter = 0;

async function createOrgProjectTask() {
  orgCounter += 1;
  const org = await Organization.create({
    name: `Org ${orgCounter}`,
    slug: `org-${orgCounter}`,
    createdBy: new mongoose.Types.ObjectId(),
  });
  const owner = await User.create({
    username: `owner${orgCounter}`,
    email: `owner${orgCounter}@example.com`,
    fullName: "Owner",
    password: "password123",
    organization: org._id,
    role: OrgRolesEnum.OWNER,
    isEmailVerified: true,
  });
  const project = await Project.create({
    name: "Project Camp",
    keyPrefix: "CAMP",
    organization: org._id,
    createdBy: owner._id,
    members: [{ user: owner._id, role: "admin" }],
  });
  const task = await Task.create({
    title: "A task",
    project: project._id,
    createdBy: owner._id,
    taskNumber: 1,
    aiLockStatus: "pending",
    evaluationSeq: 1,
    lastAppliedSeq: 0,
  });
  return { org, project, task };
}

describe("persistEvaluation", () => {
  it("APPROVED verdict sets aiLockStatus to clear and bumps lastAppliedSeq", async () => {
    const { org, project, task } = await createOrgProjectTask();

    const { applied } = await persistEvaluation({
      organizationId: org._id,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: 1,
      headSha: "sha1",
      trigger: "pull_request",
      verdict: { status: "COMPLETED", evaluation: "APPROVED", requirementsTotal: 1, requirementsMet: 1, model: "stub" },
    });

    expect(applied).toBe(true);
    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("clear");
    expect(refreshed.lastAppliedSeq).toBe(1);

    const log = await AiEvaluationLog.findOne({ task: task._id });
    expect(log.status).toBe("COMPLETED");
    expect(log.evaluation).toBe("APPROVED");
  });

  it("REJECTED verdict sets aiLockStatus to blocked", async () => {
    const { org, project, task } = await createOrgProjectTask();

    await persistEvaluation({
      organizationId: org._id,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: 1,
      headSha: "sha1",
      trigger: "pull_request",
      verdict: { status: "COMPLETED", evaluation: "REJECTED", requirementsTotal: 2, requirementsMet: 1, model: "stub" },
    });

    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("blocked");
  });

  it("fail-open: PASSED_BY_SYSTEM_ERROR always sets aiLockStatus to clear, never blocked/pending", async () => {
    const { org, project, task } = await createOrgProjectTask();

    await persistEvaluation({
      organizationId: org._id,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: 1,
      headSha: "sha1",
      trigger: "pull_request",
      verdict: { status: "PASSED_BY_SYSTEM_ERROR", evaluation: null, errorCode: "LLM_TIMEOUT" },
    });

    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("clear");

    const log = await AiEvaluationLog.findOne({ task: task._id });
    expect(log.status).toBe("PASSED_BY_SYSTEM_ERROR");
    expect(log.errorCode).toBe("LLM_TIMEOUT");
  });

  it("STALE FENCING: a lower evaluationSeq than lastAppliedSeq is discarded — the newer result already landed", async () => {
    const { org, project, task } = await createOrgProjectTask();

    // A newer run (seq 2) already landed first...
    await persistEvaluation({
      organizationId: org._id,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: 2,
      headSha: "sha2",
      trigger: "pull_request",
      verdict: { status: "COMPLETED", evaluation: "APPROVED", requirementsTotal: 1, requirementsMet: 1, model: "stub" },
    });

    // ...then an older, slower run (seq 1) tries to land after it.
    const { applied } = await persistEvaluation({
      organizationId: org._id,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: 1,
      headSha: "sha1",
      trigger: "pull_request",
      verdict: { status: "COMPLETED", evaluation: "REJECTED", requirementsTotal: 2, requirementsMet: 0, model: "stub" },
    });

    expect(applied).toBe(false);

    // The task must still reflect the newer (APPROVED) result, not get
    // clobbered by the stale REJECTED one.
    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("clear");
    expect(refreshed.lastAppliedSeq).toBe(2);

    // But the log is still written — it's the debugging surface, even for
    // discarded runs (plans/PRD_v2.md §5.6).
    const staleLog = await AiEvaluationLog.findOne({ evaluationSeq: 1 });
    expect(staleLog).not.toBeNull();
    expect(staleLog.status).toBe("SKIPPED");
    expect(staleLog.errorCode).toBe("STALE_SEQ");
  });

  it("three rapid evaluations land in issue order but only the highest seq's result sticks (lastAppliedSeq monotonic)", async () => {
    const { org, project, task } = await createOrgProjectTask();

    // Simulate out-of-order completion: seq 3 finishes first (fastest LLM
    // call), then seq 1, then seq 2 — lastAppliedSeq must end up reflecting
    // seq 3 regardless of completion order, and never regress.
    await persistEvaluation({
      organizationId: org._id, projectId: project._id, taskId: task._id,
      evaluationSeq: 3, headSha: "sha3", trigger: "pull_request",
      verdict: { status: "COMPLETED", evaluation: "APPROVED", requirementsTotal: 1, requirementsMet: 1, model: "stub" },
    });
    await persistEvaluation({
      organizationId: org._id, projectId: project._id, taskId: task._id,
      evaluationSeq: 1, headSha: "sha1", trigger: "pull_request",
      verdict: { status: "COMPLETED", evaluation: "REJECTED", requirementsTotal: 2, requirementsMet: 0, model: "stub" },
    });
    await persistEvaluation({
      organizationId: org._id, projectId: project._id, taskId: task._id,
      evaluationSeq: 2, headSha: "sha2", trigger: "pull_request",
      verdict: { status: "COMPLETED", evaluation: "REJECTED", requirementsTotal: 2, requirementsMet: 1, model: "stub" },
    });

    const refreshed = await Task.findById(task._id);
    expect(refreshed.lastAppliedSeq).toBe(3);
    expect(refreshed.aiLockStatus).toBe("clear"); // seq 3's APPROVED verdict, untouched by the later-arriving stale ones
  });
});
