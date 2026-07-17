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

describe("taskKey surfaced in every task read endpoint", () => {
  it("GET /api/v1/tasks/:projectId (getProjectTasks) includes taskKey", async () => {
    const { owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    await Task.create({
      title: "A task",
      project: project._id,
      createdBy: owner._id,
      taskNumber: 7,
    });

    const res = await request(app)
      .get(`/api/v1/tasks/${project._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks[0].taskKey).toBe("CAMP-7");
  });

  it("GET /api/v1/tasks/:projectId/timeline includes taskKey", async () => {
    const { owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    await Task.create({
      title: "A task",
      project: project._id,
      createdBy: owner._id,
      taskNumber: 3,
    });

    const res = await request(app)
      .get(`/api/v1/tasks/${project._id}/timeline`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks[0].taskKey).toBe("CAMP-3");
  });

  it("GET /api/v1/tasks/:projectId/t/:taskId (getTaskById) includes taskKey", async () => {
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
      taskNumber: 12,
    });

    const res = await request(app)
      .get(`/api/v1/tasks/${project._id}/t/${task._id}`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.task.taskKey).toBe("CAMP-12");
  });

  it("GET /api/v1/tasks/me (getMyTasks) includes taskKey per task, across different projects", async () => {
    const { owner } = await createOrg();
    const projectA = await Project.create({
      name: "Project A",
      keyPrefix: "PA",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    const projectB = await Project.create({
      name: "Project B",
      keyPrefix: "PB",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    await Task.create({
      title: "In A",
      project: projectA._id,
      createdBy: owner._id,
      assignedTo: owner._id,
      taskNumber: 1,
    });
    await Task.create({
      title: "In B",
      project: projectB._id,
      createdBy: owner._id,
      assignedTo: owner._id,
      taskNumber: 1,
    });

    const res = await request(app)
      .get("/api/v1/tasks/me")
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);
    const keys = res.body.data.tasks.map((t) => t.taskKey).sort();
    expect(keys).toEqual(["PA-1", "PB-1"]);
  });

  it("GET /api/v1/tasks/org (getOrgTasks) includes taskKey per task", async () => {
    const { owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: owner.organization,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    await Task.create({
      title: "A task",
      project: project._id,
      createdBy: owner._id,
      taskNumber: 5,
    });

    const res = await request(app)
      .get("/api/v1/tasks/org")
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks[0].taskKey).toBe("CAMP-5");
  });
});
