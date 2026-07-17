import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User, Organization, Project, Task, OrgAiSettings } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";
import { resolveContext } from "../src/dod/nodes/01-resolve-context.js";
import { createRunState } from "../src/dod/state.js";

let orgCounter = 0;

async function createOrgProjectTask(settingsOverrides = {}) {
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
  });
  if (Object.keys(settingsOverrides).length > 0) {
    await OrgAiSettings.create({ organization: org._id, ...settingsOverrides });
  }
  return { org, project, task };
}

function state(org, project, task) {
  return createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: org._id,
    projectId: project._id,
    taskId: task._id,
    evaluationSeq: 1,
    repo: { headSha: "sha1" },
  });
}

describe("resolveContext (Node 1)", () => {
  it("loads task, project, and settings onto state when everything resolves", async () => {
    const { org, project, task } = await createOrgProjectTask();
    const s = await resolveContext(state(org, project, task));

    expect(s.exit).toBeNull();
    expect(s.task._id.toString()).toBe(task._id.toString());
    expect(s.project._id.toString()).toBe(project._id.toString());
  });

  it("defaults to advisory mode when no OrgAiSettings document exists", async () => {
    const { org, project, task } = await createOrgProjectTask();
    const s = await resolveContext(state(org, project, task));

    expect(s.exit).toBeNull();
  });

  it("exits SKIPPED/AI_DISABLED when killSwitch is set", async () => {
    const { org, project, task } = await createOrgProjectTask({ killSwitch: true });
    const s = await resolveContext(state(org, project, task));

    expect(s.exit).toEqual({ status: "SKIPPED", errorCode: "AI_DISABLED" });
  });

  it("exits SKIPPED/AI_DISABLED when mode is 'off'", async () => {
    const { org, project, task } = await createOrgProjectTask({ mode: "off" });
    const s = await resolveContext(state(org, project, task));

    expect(s.exit).toEqual({ status: "SKIPPED", errorCode: "AI_DISABLED" });
  });

  it("fails closed with SKIPPED/TASK_NOT_FOUND when the task no longer exists", async () => {
    const { org, project, task } = await createOrgProjectTask();
    await Task.deleteOne({ _id: task._id });
    const s = await resolveContext(state(org, project, task));

    expect(s.exit).toEqual({ status: "SKIPPED", errorCode: "TASK_NOT_FOUND" });
  });

  it("fails closed with SKIPPED/PROJECT_NOT_FOUND when the project no longer exists", async () => {
    const { org, project, task } = await createOrgProjectTask();
    await Project.deleteOne({ _id: project._id });
    const s = await resolveContext(state(org, project, task));

    expect(s.exit).toEqual({ status: "SKIPPED", errorCode: "PROJECT_NOT_FOUND" });
  });
});
