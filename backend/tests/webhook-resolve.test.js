import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User, Organization, Project, Task, GithubInstallation } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";
import { resolveWebhookContext } from "../src/services/webhook-resolve.js";

let orgCounter = 0;

async function setup({
  withInstallation = true,
  withBoundRepo = true,
  installationId = 999,
  repoGithubId = 111,
} = {}) {
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

  let installation = null;
  if (withInstallation) {
    installation = await GithubInstallation.create({
      organization: org._id,
      installationId,
      accountLogin: "acme",
      installedBy: owner._id,
    });
  }

  const project = await Project.create({
    name: "Project Camp",
    keyPrefix: "CAMP",
    organization: org._id,
    createdBy: owner._id,
    members: [{ user: owner._id, role: "admin" }],
    ...(withBoundRepo
      ? { githubRepo: { githubId: repoGithubId, fullName: "acme/widgets", defaultBranch: "main" } }
      : {}),
  });

  const task = await Task.create({
    title: "Add refresh token",
    project: project._id,
    createdBy: owner._id,
    taskNumber: 104,
  });

  return { org, owner, project, task, installation };
}

describe("resolveWebhookContext", () => {
  it("resolves the full chain: installation -> project -> task", async () => {
    const { org, project, task } = await setup();

    const result = await resolveWebhookContext({
      installationId: 999,
      repoGithubId: 111,
      branch: "feature/CAMP-104-x",
    });

    expect(result.miss).toBeUndefined();
    expect(result.organizationId.toString()).toBe(org._id.toString());
    expect(result.project._id.toString()).toBe(project._id.toString());
    expect(result.task._id.toString()).toBe(task._id.toString());
  });

  it("misses cleanly on an unknown installation", async () => {
    await setup();
    const result = await resolveWebhookContext({
      installationId: 555, // not registered
      repoGithubId: 111,
      branch: "feature/CAMP-104-x",
    });
    expect(result.miss).toBe("unknown_installation");
  });

  it("misses cleanly on an unbound repo", async () => {
    await setup({ withBoundRepo: false });
    const result = await resolveWebhookContext({
      installationId: 999,
      repoGithubId: 111,
      branch: "feature/CAMP-104-x",
    });
    expect(result.miss).toBe("unbound_repo");
  });

  it("misses cleanly when no task key is found in branch/title/body", async () => {
    await setup();
    const result = await resolveWebhookContext({
      installationId: 999,
      repoGithubId: 111,
      branch: "feature/misc-cleanup",
    });
    expect(result.miss).toBe("no_task_key");
  });

  it("misses cleanly when the task key parses but no such task exists", async () => {
    await setup();
    const result = await resolveWebhookContext({
      installationId: 999,
      repoGithubId: 111,
      branch: "feature/CAMP-9999-x", // valid prefix, nonexistent task number
    });
    expect(result.miss).toBe("task_not_found");
  });

  it("CROSS-TENANT ISOLATION: two orgs with the identical-looking CAMP-104 key never resolve to each other's task", async () => {
    // Org A and org B each independently have a project prefixed "CAMP" and
    // a task numbered 104 — same human-readable key, different everything
    // else. A webhook naming CAMP-104 must resolve strictly via
    // installation -> repo -> project, never by matching the key string
    // across tenants.
    const { org: orgA, task: taskA } = await setup({ installationId: 100, repoGithubId: 200 });
    const { org: orgB, task: taskB } = await setup({ installationId: 101, repoGithubId: 201 });

    const resultA = await resolveWebhookContext({
      installationId: 100,
      repoGithubId: 200,
      branch: "feature/CAMP-104-x",
    });
    const resultB = await resolveWebhookContext({
      installationId: 101,
      repoGithubId: 201,
      branch: "feature/CAMP-104-x",
    });

    expect(resultA.organizationId.toString()).toBe(orgA._id.toString());
    expect(resultA.task._id.toString()).toBe(taskA._id.toString());

    expect(resultB.organizationId.toString()).toBe(orgB._id.toString());
    expect(resultB.task._id.toString()).toBe(taskB._id.toString());

    // The two resolutions must never point at each other's task.
    expect(resultA.task._id.toString()).not.toBe(resultB.task._id.toString());
  });
});
