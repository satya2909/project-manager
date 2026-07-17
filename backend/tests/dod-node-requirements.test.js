import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { User, Organization, Project, Task, SubTask } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";
import { loadOrDecomposeRequirements } from "../src/dod/nodes/04-requirements.js";
import { createRunState } from "../src/dod/state.js";

let orgCounter = 0;

async function createOrgProjectTask(taskOverrides = {}) {
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
    title: "Add JWT auth",
    description: "Protect routes with JWT",
    project: project._id,
    createdBy: owner._id,
    taskNumber: 1,
    ...taskOverrides,
  });
  return { org, project, task };
}

function state(task) {
  const s = createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: task.project,
    projectId: task.project,
    taskId: task._id,
    evaluationSeq: 1,
    repo: { headSha: "sha1" },
  });
  s.task = task;
  return s;
}

describe("loadOrDecomposeRequirements (Node 4)", () => {
  it("reuses persisted active requirements without calling the LLM", async () => {
    const { task } = await createOrgProjectTask({
      requirements: [
        { text: "JWT is verified on protected routes", source: "human", active: true },
        { text: "Deactivated req", source: "ai", active: false },
      ],
    });
    const llmClient = vi.fn();

    const s = await loadOrDecomposeRequirements(state(task), { llmClient });

    expect(llmClient).not.toHaveBeenCalled();
    expect(s.exit).toBeNull();
    expect(s.requirements).toHaveLength(1);
    expect(s.requirements[0].text).toBe("JWT is verified on protected routes");
  });

  it("decomposes once via the LLM when there are no active requirements, and persists them", async () => {
    const { task } = await createOrgProjectTask();
    await SubTask.create({ title: "Write middleware", task: task._id, createdBy: task.createdBy });

    const llmClient = vi.fn(async () => ({
      content: { requirements: ["Route uses verifyJWT middleware", "Invalid token returns 401"] },
      tokensUsed: 100,
    }));

    const s = await loadOrDecomposeRequirements(state(task), { llmClient });

    expect(llmClient).toHaveBeenCalledTimes(1);
    expect(s.exit).toBeNull();
    expect(s.requirements).toHaveLength(2);
    expect(s.budget.tokensUsed).toBe(100);
    expect(s.budget.llmCalls).toBe(1);

    const refreshed = await Task.findById(task._id);
    expect(refreshed.requirements).toHaveLength(2);
    expect(refreshed.requirements[0].source).toBe("ai");
    expect(refreshed.requirementsVersion).toBe(1);
  });

  it("caps decomposition at 8 requirements even if the model returns more", async () => {
    const { task } = await createOrgProjectTask();
    const llmClient = vi.fn(async () => ({
      content: { requirements: Array.from({ length: 12 }, (_, i) => `req ${i}`) },
      tokensUsed: 10,
    }));

    const s = await loadOrDecomposeRequirements(state(task), { llmClient });

    expect(s.requirements).toHaveLength(8);
  });

  it("exits SKIPPED/NO_ACTIVE_REQUIREMENTS when decomposition yields nothing usable", async () => {
    const { task } = await createOrgProjectTask();
    const llmClient = vi.fn(async () => ({ content: { requirements: [] }, tokensUsed: 5 }));

    const s = await loadOrDecomposeRequirements(state(task), { llmClient });

    expect(s.exit).toEqual({ status: "SKIPPED", errorCode: "NO_ACTIVE_REQUIREMENTS" });
  });

  it("fails open with PASSED_BY_SYSTEM_ERROR when the LLM call throws (timeout/malformed output)", async () => {
    const { task } = await createOrgProjectTask();
    const llmClient = vi.fn(async () => {
      throw new Error("LLM call failed after 3 attempts");
    });

    const s = await loadOrDecomposeRequirements(state(task), { llmClient });

    expect(s.exit).toEqual({ status: "PASSED_BY_SYSTEM_ERROR", errorCode: "LLM_TIMEOUT" });
  });
});
