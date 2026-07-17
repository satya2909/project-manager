import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User, Organization, Project, Task } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";

let orgCounter = 0;

async function createOrgAndOwner() {
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
    role: OrgRolesEnum.OWNER,
    isEmailVerified: true,
  });
  org.createdBy = owner._id;
  await org.save();
  return { org, owner };
}

describe("Project.memberCount virtual", () => {
  it("does not throw when the project is populated without `members` (narrow field selection)", async () => {
    // Regression test — found while wiring createTask's taskKey computation:
    // `.populate("project", "keyPrefix")` loads a Project doc without
    // `members`, but memberCount's virtual getter still runs during
    // toJSON()/toObject() regardless of what was selected.
    const { org, owner } = await createOrgAndOwner();
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

    const populated = await Task.findById(task._id).populate(
      "project",
      "keyPrefix",
    );

    expect(() => populated.toJSON()).not.toThrow();
    expect(populated.project.memberCount).toBe(0);
  });
});

describe("Task.taskKey virtual", () => {
  it("computes `${project.keyPrefix}-${taskNumber}` when the project is populated", async () => {
    const { org, owner } = await createOrgAndOwner();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    const task = await Task.create({
      title: "Add refresh token",
      project: project._id,
      createdBy: owner._id,
      taskNumber: 104,
    });

    const populated = await Task.findById(task._id).populate(
      "project",
      "keyPrefix",
    );

    expect(populated.taskKey).toBe("CAMP-104");
  });

  it("is null when the project isn't populated (no prefix available)", async () => {
    const { org, owner } = await createOrgAndOwner();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    const task = await Task.create({
      title: "Add refresh token",
      project: project._id,
      createdBy: owner._id,
      taskNumber: 104,
    });

    expect(task.taskKey).toBeNull();
  });
});

describe("Task.taskNumber uniqueness", () => {
  it("rejects two tasks in the same project with the same taskNumber", async () => {
    const { org, owner } = await createOrgAndOwner();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    await Task.create({
      title: "First",
      project: project._id,
      createdBy: owner._id,
      taskNumber: 1,
    });

    await expect(
      Task.create({
        title: "Second",
        project: project._id,
        createdBy: owner._id,
        taskNumber: 1,
      }),
    ).rejects.toThrow();
  });

  it("allows the same taskNumber in two different projects (uniqueness is per-project)", async () => {
    const { org, owner } = await createOrgAndOwner();
    const projectA = await Project.create({
      name: "Project A",
      keyPrefix: "PA",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });
    const projectB = await Project.create({
      name: "Project B",
      keyPrefix: "PB",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    await Task.create({
      title: "First",
      project: projectA._id,
      createdBy: owner._id,
      taskNumber: 1,
    });

    await expect(
      Task.create({
        title: "First",
        project: projectB._id,
        createdBy: owner._id,
        taskNumber: 1,
      }),
    ).resolves.toBeTruthy();
  });
});

describe("Project.keyPrefix", () => {
  it("requires a keyPrefix to create a project", async () => {
    const { org, owner } = await createOrgAndOwner();
    await expect(
      Project.create({
        name: "No Prefix",
        organization: org._id,
        createdBy: owner._id,
        members: [{ user: owner._id, role: "admin" }],
      }),
    ).rejects.toThrow();
  });

  it("allows any number of projects in the same org with zero aliases (partial index, not sparse)", async () => {
    // Regression test: a *compound* sparse index only excludes a document
    // when ALL its fields are missing, not just prefixAliases — since
    // organization is always present, naive `sparse: true` here would make
    // every alias-less project in the org collide on the same index entry.
    const { org, owner } = await createOrgAndOwner();
    await Project.create({
      name: "Project A",
      keyPrefix: "PA",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    await expect(
      Project.create({
        name: "Project B",
        keyPrefix: "PB",
        organization: org._id,
        createdBy: owner._id,
        members: [{ user: owner._id, role: "admin" }],
      }),
    ).resolves.toBeTruthy();
  });

  it("rejects two projects in the same org sharing an alias", async () => {
    const { org, owner } = await createOrgAndOwner();
    await Project.create({
      name: "Project A",
      keyPrefix: "PA",
      prefixAliases: ["OLD"],
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    await expect(
      Project.create({
        name: "Project B",
        keyPrefix: "PB",
        prefixAliases: ["OLD"],
        organization: org._id,
        createdBy: owner._id,
        members: [{ user: owner._id, role: "admin" }],
      }),
    ).rejects.toThrow();
  });

  it("defaults prefixAliases and taskCounter to empty/zero", async () => {
    const { org, owner } = await createOrgAndOwner();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    expect(project.prefixAliases).toEqual([]);
    expect(project.taskCounter).toBe(0);
  });
});
