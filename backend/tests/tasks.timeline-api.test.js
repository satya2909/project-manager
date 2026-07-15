import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User, Organization, Project, Task, Activity } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";

// log() in task.controllers.js is fire-and-forget (Activity.create(...).catch(...),
// never awaited by the response) — a brief wait after the request lets that write
// land before asserting on it, without slowing down every other test in this file.
const waitForActivityLog = () => new Promise((resolve) => setTimeout(resolve, 50));

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

async function createProject(org, createdBy, extraMembers = []) {
  return Project.create({
    name: `Project for ${org.slug}`,
    organization: org._id,
    createdBy: createdBy._id,
    members: [
      { user: createdBy._id, role: "admin" },
      ...extraMembers.map((u) => ({ user: u._id, role: "member" })),
    ],
  });
}

async function createTask(project, createdBy, overrides = {}) {
  return Task.create({
    title: "Task",
    project: project._id,
    createdBy: createdBy._id,
    ...overrides,
  });
}

function tokenFor(user) {
  return user.generateAccessToken();
}

// ─── GET /tasks/:projectId/timeline ────────────────────────────────────────
describe("GET /api/v1/tasks/:projectId/timeline", () => {
  it("401s when no access token is provided", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const res = await request(app).get(`/api/v1/tasks/${project._id}/timeline`);
    expect(res.status).toBe(401);
  });

  it("200s for a plain project member (read-only, not manager-gated)", async () => {
    const { org, owner } = await createOrg();
    const member = await createUser(org, OrgRolesEnum.MEMBER, "member1");
    const project = await createProject(org, owner, [member]);
    await createTask(project, owner, {
      title: "Scheduled",
      startDate: new Date("2026-08-01"),
      dueDate: new Date("2026-08-05"),
    });

    const res = await request(app)
      .get(`/api/v1/tasks/${project._id}/timeline`)
      .set("Authorization", `Bearer ${tokenFor(member)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0]).toHaveProperty("startDate");
    expect(res.body.data.tasks[0]).toHaveProperty("dueDate");
    expect(res.body.data.tasks[0]).not.toHaveProperty("attachments");
  });
});

// ─── PATCH /tasks/:projectId/t/:taskId/schedule ────────────────────────────
describe("PATCH /api/v1/tasks/:projectId/t/:taskId/schedule", () => {
  it("401s when no access token is provided", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const task = await createTask(project, owner);

    const res = await request(app).patch(
      `/api/v1/tasks/${project._id}/t/${task._id}/schedule`,
    );
    expect(res.status).toBe(401);
  });

  it("403s for a plain member (not a manager)", async () => {
    const { org, owner } = await createOrg();
    const member = await createUser(org, OrgRolesEnum.MEMBER, "member1");
    const project = await createProject(org, owner, [member]);
    const task = await createTask(project, owner);

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${task._id}/schedule`)
      .set("Authorization", `Bearer ${tokenFor(member)}`)
      .send({ dueDate: "2026-08-05" });

    expect(res.status).toBe(403);
  });

  it("200s for a manager and persists the new dates", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const task = await createTask(project, owner);

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${task._id}/schedule`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ startDate: "2026-08-01", dueDate: "2026-08-05" });

    expect(res.status).toBe(200);
    expect(new Date(res.body.data.task.dueDate).toISOString()).toBe(
      new Date("2026-08-05").toISOString(),
    );

    // D9: a reschedule must be visible in the project's Activity feed — this
    // is the one thing that review requirement was actually about, and
    // nothing else in this suite verified log() actually fires.
    await waitForActivityLog();
    const activity = await Activity.findOne({ project: project._id, action: "rescheduled_task" });
    expect(activity).not.toBeNull();
    expect(activity.target).toBe(task.title);
    expect(activity.metadata.to.dueDate).toBeTruthy();
  });

  it("400s when dueDate is before startDate", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const task = await createTask(project, owner, {
      startDate: new Date("2026-08-10"),
    });

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${task._id}/schedule`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ dueDate: "2026-08-01" });

    expect(res.status).toBe(400);
  });

  it("422s (route-level validator) on a malformed date string", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const task = await createTask(project, owner);

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${task._id}/schedule`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ dueDate: "not-a-date" });

    expect(res.status).toBe(422);
  });
});

// ─── PATCH /tasks/:projectId/t/:taskId/dependencies ────────────────────────
describe("PATCH /api/v1/tasks/:projectId/t/:taskId/dependencies", () => {
  it("401s when no access token is provided", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const task = await createTask(project, owner);

    const res = await request(app).patch(
      `/api/v1/tasks/${project._id}/t/${task._id}/dependencies`,
    );
    expect(res.status).toBe(401);
  });

  it("403s for a plain member (not a manager)", async () => {
    const { org, owner } = await createOrg();
    const member = await createUser(org, OrgRolesEnum.MEMBER, "member1");
    const project = await createProject(org, owner, [member]);
    const a = await createTask(project, owner, { title: "Task A" });
    const b = await createTask(project, owner, { title: "Task B" });

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${b._id}/dependencies`)
      .set("Authorization", `Bearer ${tokenFor(member)}`)
      .send({ dependsOn: [a._id.toString()] });

    expect(res.status).toBe(403);
  });

  it("200s for a manager and links the dependency", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const a = await createTask(project, owner, { title: "Task A" });
    const b = await createTask(project, owner, { title: "Task B" });

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${b._id}/dependencies`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ dependsOn: [a._id.toString()] });

    expect(res.status).toBe(200);
    // Response must return dependsOn populated with titles (not raw
    // ObjectIds) — the frontend's dependency-line rendering reads
    // dep.title/dep._id directly off the PATCH response, same shape as
    // GET /timeline.
    expect(res.body.data.task.dependsOn[0]).toHaveProperty("title", "Task A");

    const refreshed = await Task.findById(b._id);
    expect(refreshed.dependsOn.map(String)).toEqual([a._id.toString()]);

    // D9: linking must show up in the Activity feed too, same as reschedule.
    await waitForActivityLog();
    const activity = await Activity.findOne({ project: project._id, action: "linked_dependency" });
    expect(activity).not.toBeNull();
    expect(activity.target).toBe("Task B");
    expect(activity.metadata.dependsOnTitle).toBe("Task A");
  });

  it("200s and unlinks when the new array omits a previously-linked task", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const a = await createTask(project, owner, { title: "Task A" });
    const b = await createTask(project, owner, { title: "Task B", dependsOn: [a._id] });

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${b._id}/dependencies`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ dependsOn: [] });

    expect(res.status).toBe(200);

    const refreshed = await Task.findById(b._id);
    expect(refreshed.dependsOn).toHaveLength(0);

    // D9: unlinking must show up in the Activity feed too.
    await waitForActivityLog();
    const activity = await Activity.findOne({ project: project._id, action: "unlinked_dependency" });
    expect(activity).not.toBeNull();
    expect(activity.metadata.dependsOnTitle).toBe("Task A");
  });

  it("409s when the new link would create a cycle", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    // A depends on B already.
    const b = await createTask(project, owner, { title: "Task B" });
    const a = await createTask(project, owner, { title: "Task A", dependsOn: [b._id] });

    // Attempt "B depends on A" — would close A → B → A.
    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${b._id}/dependencies`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ dependsOn: [a._id.toString()] });

    expect(res.status).toBe(409);
  });

  it("400s when the dependency target is in a different project", async () => {
    const { org, owner } = await createOrg();
    const projectA = await createProject(org, owner);
    const projectB = await createProject(org, owner);
    const taskInA = await createTask(projectA, owner, { title: "In A" });
    const taskInB = await createTask(projectB, owner, { title: "In B" });

    const res = await request(app)
      .patch(`/api/v1/tasks/${projectA._id}/t/${taskInA._id}/dependencies`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ dependsOn: [taskInB._id.toString()] });

    expect(res.status).toBe(400);
  });

  it("422s (route-level validator) on a malformed dependency id", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);
    const task = await createTask(project, owner);

    const res = await request(app)
      .patch(`/api/v1/tasks/${project._id}/t/${task._id}/dependencies`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ dependsOn: ["not-an-id"] });

    expect(res.status).toBe(422);
  });
});

// ─── POST /tasks/:projectId — startDate/dueDate at creation (Phase 6 prereq) ─
describe("POST /api/v1/tasks/:projectId — scheduling fields at creation", () => {
  it("200s and persists startDate/dueDate when provided", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const res = await request(app)
      .post(`/api/v1/tasks/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ title: "Inline-created task", startDate: "2026-08-01", dueDate: "2026-08-03" });

    expect(res.status).toBe(201);
    expect(new Date(res.body.data.task.dueDate).toISOString()).toBe(
      new Date("2026-08-03").toISOString(),
    );

    const stored = await Task.findById(res.body.data.task._id);
    expect(stored.startDate).not.toBeNull();
  });

  it("400s when dueDate is before startDate at creation", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const res = await request(app)
      .post(`/api/v1/tasks/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ title: "Bad dates at creation", startDate: "2026-08-10", dueDate: "2026-08-01" });

    expect(res.status).toBe(400);
  });

  it("creates fine with no dates at all (existing behavior unaffected)", async () => {
    const { org, owner } = await createOrg();
    const project = await createProject(org, owner);

    const res = await request(app)
      .post(`/api/v1/tasks/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ title: "No dates task" });

    expect(res.status).toBe(201);
    expect(res.body.data.task.startDate).toBeFalsy();
    expect(res.body.data.task.dueDate).toBeFalsy();
  });
});
