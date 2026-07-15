import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User, Organization, Project, Task } from "../src/models/index.js";
import { OrgRolesEnum, TaskStatusEnum } from "../src/utils/constants.js";

// ─── fixtures ───────────────────────────────────────────────────────────────
let orgCounter = 0;

// Org.createdBy and User.organization are both required, so neither can be
// created first in isolation — create the org with a placeholder createdBy,
// then the owner referencing it, then patch createdBy to the real owner.
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

async function createUser(org, role, username) {
  return User.create({
    username,
    email: `${username}@example.com`,
    fullName: username,
    password: "password123",
    organization: org._id,
    role,
    isEmailVerified: true,
  });
}

async function createProjectWithTask(org, createdBy, { title = "Task", status = TaskStatusEnum.TODO } = {}) {
  const project = await Project.create({
    name: `Project for ${org.slug}`,
    organization: org._id,
    createdBy: createdBy._id,
    members: [{ user: createdBy._id, role: "admin" }],
  });
  const task = await Task.create({
    title,
    project: project._id,
    createdBy: createdBy._id,
    status,
  });
  return { project, task };
}

function tokenFor(user) {
  return user.generateAccessToken();
}

// ─── tests ──────────────────────────────────────────────────────────────────
describe("GET /api/v1/tasks/org", () => {
  it("401s when no access token is provided", async () => {
    const res = await request(app).get("/api/v1/tasks/org");
    expect(res.status).toBe(401);
  });

  it("403s for a plain org member", async () => {
    const { org, owner } = await createOrg();
    const member = await createUser(org, OrgRolesEnum.MEMBER, "member1");
    await createProjectWithTask(org, owner);

    const res = await request(app)
      .get("/api/v1/tasks/org")
      .set("Authorization", `Bearer ${tokenFor(member)}`);

    expect(res.status).toBe(403);
  });

  it("200s for an org owner and returns every task in their org", async () => {
    const { org, owner } = await createOrg();
    const { task: task1 } = await createProjectWithTask(org, owner, { title: "First" });
    const { task: task2 } = await createProjectWithTask(org, owner, { title: "Second" });

    const res = await request(app)
      .get("/api/v1/tasks/org")
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.tasks.map((t) => t._id);
    expect(ids.sort()).toEqual([task1._id.toString(), task2._id.toString()].sort());
    // Response shape the frontend hub relies on:
    expect(res.body.data.tasks[0]).toHaveProperty("project.name");
    expect(res.body.data.tasks[0]).toHaveProperty("status");
  });

  it("200s for an org admin (not just owner)", async () => {
    const { org, owner } = await createOrg();
    const admin = await createUser(org, OrgRolesEnum.ADMIN, "admin1");
    await createProjectWithTask(org, owner);

    const res = await request(app)
      .get("/api/v1/tasks/org")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
  });

  it("never returns another organization's tasks (tenant isolation)", async () => {
    const { org: orgA, owner: ownerA } = await createOrg();
    const { org: orgB, owner: ownerB } = await createOrg();
    await createProjectWithTask(orgA, ownerA, { title: "Org A task" });
    const { task: orgBTask } = await createProjectWithTask(orgB, ownerB, { title: "Org B task" });

    const res = await request(app)
      .get("/api/v1/tasks/org")
      .set("Authorization", `Bearer ${tokenFor(ownerA)}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.tasks.map((t) => t._id);
    expect(ids).not.toContain(orgBTask._id.toString());
  });
});
