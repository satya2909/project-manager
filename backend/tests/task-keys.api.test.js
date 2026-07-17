import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User, Organization, Project, Task } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";

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

function tokenFor(user) {
  return user.generateAccessToken();
}

describe("POST /api/v1/projects — keyPrefix", () => {
  it("creates the project with the explicit keyPrefix provided", async () => {
    const { owner } = await createOrg();

    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ name: "Project Camp", keyPrefix: "camp" }); // lowercase in -> uppercase out

    expect(res.status).toBe(201);
    expect(res.body.data.project.keyPrefix).toBe("CAMP");
  });

  it("derives a keyPrefix from the name when none is provided", async () => {
    const { owner } = await createOrg();

    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ name: "Growth Initiative" });

    expect(res.status).toBe(201);
    expect(res.body.data.project.keyPrefix).toMatch(/^[A-Z]{2,6}$/);
  });

  it("409s when the keyPrefix is already used by another project in the org", async () => {
    const { owner } = await createOrg();
    await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ name: "Second Camp", keyPrefix: "CAMP" });

    expect(res.status).toBe(409);
  });

  it("409s when the keyPrefix matches another project's alias in the org", async () => {
    const { owner } = await createOrg();
    await Project.create({
      name: "Project Camp",
      keyPrefix: "PC",
      prefixAliases: ["CAMP"],
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ name: "New Project", keyPrefix: "CAMP" });

    expect(res.status).toBe(409);
  });

  it("allows the same keyPrefix in two different orgs", async () => {
    const { owner: ownerA } = await createOrg();
    await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: ownerA.organization,
      createdBy: ownerA._id,
      members: [{ user: ownerA._id, role: "admin" }],
    });

    const { owner: ownerB } = await createOrg();
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${tokenFor(ownerB)}`)
      .send({ name: "Project Camp", keyPrefix: "CAMP" });

    expect(res.status).toBe(201);
  });
});

describe("PUT /api/v1/projects/:projectId — keyPrefix rename", () => {
  it("moves the old prefix into prefixAliases and sets the new one", async () => {
    const { owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .put(`/api/v1/projects/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ keyPrefix: "PC" });

    expect(res.status).toBe(200);
    expect(res.body.data.project.keyPrefix).toBe("PC");
    expect(res.body.data.project.prefixAliases).toContain("CAMP");
  });

  it("touches zero tasks — taskKey recomputes from the new prefix without any task write", async () => {
    const { owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    const task = await Task.create({
      title: "A task",
      project: project._id,
      createdBy: owner._id,
      taskNumber: 1,
    });
    const beforeUpdatedAt = task.updatedAt;

    await request(app)
      .put(`/api/v1/projects/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ keyPrefix: "PC" });

    const refreshed = await Task.findById(task._id).populate(
      "project",
      "keyPrefix",
    );
    expect(refreshed.updatedAt.getTime()).toBe(beforeUpdatedAt.getTime());
    expect(refreshed.taskKey).toBe("PC-1");
  });

  it("rejects renaming to a prefix already used (as prefix or alias) elsewhere in the org", async () => {
    const { owner } = await createOrg();
    await Project.create({
      name: "Other Project",
      keyPrefix: "OTHER",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .put(`/api/v1/projects/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ keyPrefix: "OTHER" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/v1/tasks/:projectId — taskNumber allocation", () => {
  it("assigns sequential taskNumbers and returns the computed taskKey", async () => {
    const { owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const first = await request(app)
      .post(`/api/v1/tasks/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ title: "First task" });
    const second = await request(app)
      .post(`/api/v1/tasks/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ title: "Second task" });

    expect(first.body.data.task.taskNumber).toBe(1);
    expect(second.body.data.task.taskNumber).toBe(2);
    expect(first.body.data.task.taskKey).toBe("CAMP-1");
    expect(second.body.data.task.taskKey).toBe("CAMP-2");
  });

  it("two concurrent creates in the same project get distinct taskNumbers (no race)", async () => {
    const { owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/v1/tasks/${project._id}`)
        .set("Authorization", `Bearer ${tokenFor(owner)}`)
        .send({ title: "Task A" }),
      request(app)
        .post(`/api/v1/tasks/${project._id}`)
        .set("Authorization", `Bearer ${tokenFor(owner)}`)
        .send({ title: "Task B" }),
    ]);

    const numbers = [a.body.data.task.taskNumber, b.body.data.task.taskNumber].sort();
    expect(numbers).toEqual([1, 2]);
  });
});
