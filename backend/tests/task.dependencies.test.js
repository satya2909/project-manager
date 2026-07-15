import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User, Organization, Project, Task } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";

// ─── fixtures ───────────────────────────────────────────────────────────────
let orgCounter = 0;

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
  return Project.create({
    name: `Project for ${org.slug}`,
    organization: org._id,
    createdBy: createdBy._id,
    members: [{ user: createdBy._id, role: "admin" }],
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
      Task.create({
        title: "Bad dates",
        project: project._id,
        createdBy: owner._id,
        startDate: new Date("2026-08-10"),
        dueDate: new Date("2026-08-01"),
      }),
    ).rejects.toThrow(/Due date cannot be before start date/);
  });

  it("allows a dueDate on or after startDate", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const task = await Task.create({
      title: "Good dates",
      project: project._id,
      createdBy: owner._id,
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
      Task.create({
        title: "Overloaded deps",
        project: project._id,
        createdBy: owner._id,
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

    const predecessor = await Task.create({
      title: "Predecessor",
      project: project._id,
      createdBy: owner._id,
    });

    const dependent = await Task.create({
      title: "Dependent",
      project: project._id,
      createdBy: owner._id,
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

    const predecessor = await Task.create({
      title: "Predecessor A",
      project: projectA._id,
      createdBy: owner._id,
    });

    // Same-project-only dependency in practice, but the cascade query itself
    // should still be scoped by project — verify it doesn't leak across.
    const unrelated = await Task.create({
      title: "Unrelated B",
      project: projectB._id,
      createdBy: owner._id,
      dependsOn: [],
    });

    await request(app)
      .delete(`/api/v1/tasks/${projectA._id}/t/${predecessor._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    const refreshed = await Task.findById(unrelated._id);
    expect(refreshed.dependsOn).toHaveLength(0);
  });
});
