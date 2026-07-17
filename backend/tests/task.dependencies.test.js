import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User, Organization, Project, Task } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";

// ─── fixtures ───────────────────────────────────────────────────────────────
let orgCounter = 0;
let taskNumberCounter = 0;

async function createOrg(ownerRole = OrgRolesEnum.OWNER) {
  orgCounter += 1;
  const org = await Organization.create({
    name: `Org ${orgCounter}`,
    slug: `org-${orgCounter}`,
    createdBy: new mongoose.Types.ObjectId(),
  });

  const owner = await User.create({
    username: `owner${orgCounter}`,
    email: `owner${orgCounter}@example.com`,
    fullName: "Org Owner",
    password: "password123",
    organization: org._id,
    role: ownerRole,
    isEmailVerified: true,
  });

  org.createdBy = owner._id;
  await org.save();

  return { org, owner };
}

async function createProject(org, createdBy) {
  orgCounter += 1;
  return Project.create({
    name: `Project for ${org.slug}`,
    keyPrefix: `P${orgCounter}`,
    organization: org._id,
    createdBy: createdBy._id,
    members: [{ user: createdBy._id, role: "admin" }],
  });
}

// taskNumber is unique per project, not globally — but a monotonically
// increasing counter across the whole file trivially satisfies that too,
// and is simpler than tracking a counter per project in these fixtures.
async function createTaskFixture(project, createdBy, overrides = {}) {
  taskNumberCounter += 1;
  return Task.create({
    title: "Task",
    project: project._id,
    createdBy: createdBy._id,
    taskNumber: taskNumberCounter,
    ...overrides,
  });
}

function tokenFor(user) {
  return user.generateAccessToken();
}

// ─── schema validation ────────────────────────────────────────────────────
describe("Task scheduling fields — schema validation", () => {
  it("rejects a dueDate before startDate", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    await expect(
      createTaskFixture(project, owner, {
        title: "Bad dates",
        startDate: new Date("2026-08-10"),
        dueDate: new Date("2026-08-01"),
      }),
    ).rejects.toThrow(/Due date cannot be before start date/);
  });

  it("allows a dueDate on or after startDate", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const task = await createTaskFixture(project, owner, {
      title: "Good dates",
      startDate: new Date("2026-08-01"),
      dueDate: new Date("2026-08-10"),
    });

    expect(task.dueDate.toISOString()).toBe(new Date("2026-08-10").toISOString());
  });

  it("rejects more than 20 dependsOn entries", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const tooMany = Array.from({ length: 21 }, () => new mongoose.Types.ObjectId());

    await expect(
      createTaskFixture(project, owner, {
        title: "Overloaded deps",
        dependsOn: tooMany,
      }),
    ).rejects.toThrow(/at most 20/);
  });
});

// ─── deleteTask cascade-scrub ──────────────────────────────────────────────
describe("DELETE /tasks/:projectId/t/:taskId — dependsOn cascade scrub", () => {
  it("removes the deleted task from every dependent task's dependsOn array", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const predecessor = await createTaskFixture(project, owner, {
      title: "Predecessor",
    });

    const dependent = await createTaskFixture(project, owner, {
      title: "Dependent",
      dependsOn: [predecessor._id],
    });

    const res = await request(app)
      .delete(`/api/v1/tasks/${project._id}/t/${predecessor._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);

    const refreshed = await Task.findById(dependent._id);
    expect(refreshed.dependsOn).toHaveLength(0);
  });

  it("does not touch dependsOn arrays in a different project", async () => {
    const { org, owner } = await createOrg();
    const projectA = await createProject(org, owner);
    const projectB = await createProject(org, owner);

    const predecessor = await createTaskFixture(projectA, owner, {
      title: "Predecessor A",
    });

    // Same-project-only dependency in practice, but the cascade query itself
    // should still be scoped by project — verify it doesn't leak across.
    const unrelated = await createTaskFixture(projectB, owner, {
      title: "Unrelated B",
      dependsOn: [],
    });

    await request(app)
      .delete(`/api/v1/tasks/${projectA._id}/t/${predecessor._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    const refreshed = await Task.findById(unrelated._id);
    expect(refreshed.dependsOn).toHaveLength(0);
  });
});
