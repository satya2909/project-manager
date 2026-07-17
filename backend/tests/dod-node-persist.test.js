import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User, Organization, Project, Task, AiEvaluationLog } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";
import { persist } from "../src/dod/nodes/12-persist.js";
import { createRunState } from "../src/dod/state.js";

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

describe("persist (Node 12)", () => {
  it("persists an exit-derived verdict (e.g. a fail-open from an earlier node)", async () => {
    const { org, project, task } = await createOrgProjectTask();
    const s = createRunState({
      runId: "run1",
      trigger: "pull_request",
      organizationId: org._id,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: 1,
      repo: { headSha: "sha1" },
    });
    s.exit = { status: "PASSED_BY_SYSTEM_ERROR", errorCode: "QUOTA_EXCEEDED" };

    await persist(s);

    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("clear");

    const log = await AiEvaluationLog.findOne({ task: task._id });
    expect(log.status).toBe("PASSED_BY_SYSTEM_ERROR");
    expect(log.errorCode).toBe("QUOTA_EXCEEDED");
  });

  it("persists a completed verdict built up from state.verdict/findings/diff", async () => {
    const { org, project, task } = await createOrgProjectTask();
    const s = createRunState({
      runId: "run1",
      trigger: "pull_request",
      organizationId: org._id,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: 1,
      repo: { headSha: "sha1" },
    });
    s.pinnedSha = "sha1";
    s.verdict = { evaluation: "APPROVED", requirementsTotal: 1, requirementsMet: 1, confidence: 0.9, critique: "good" };
    s.findings = [{ requirementId: new mongoose.Types.ObjectId(), status: "met", citations: [], rationale: "ok" }];
    s.diff.strippedPaths = ["dist/x.js"];
    s.promptVersion = "v1";
    s.model = "claude-sonnet-4-6";
    s.budget.tokensUsed = 42;

    await persist(s);

    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("clear");

    const log = await AiEvaluationLog.findOne({ task: task._id });
    expect(log.status).toBe("COMPLETED");
    expect(log.evaluation).toBe("APPROVED");
    expect(log.findings).toHaveLength(1);
    expect(log.strippedPaths).toEqual(["dist/x.js"]);
    expect(log.promptVersion).toBe("v1");
    expect(log.tokensUsed).toBe(42);
  });
});
