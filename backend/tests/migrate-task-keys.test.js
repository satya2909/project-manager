import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User, Organization, Project, Task } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";
import { migrateTaskKeys } from "../src/scripts/migrate-task-keys.js";

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

// Insert raw documents via the driver, bypassing Mongoose schema validation —
// this simulates real pre-migration legacy data (created before keyPrefix/
// taskNumber existed as required fields), which Mongoose's `required` can't
// retroactively enforce on documents already in the collection.
async function insertLegacyProject(org, owner, name) {
  const { insertedId } = await Project.collection.insertOne({
    name,
    organization: org._id,
    createdBy: owner._id,
    members: [{ user: owner._id, role: "admin" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return insertedId;
}

async function insertLegacyTask(projectId, owner, title, createdAt) {
  const { insertedId } = await Task.collection.insertOne({
    title,
    project: projectId,
    createdBy: owner._id,
    status: "todo",
    createdAt,
    updatedAt: createdAt,
  });
  return insertedId;
}

describe("migrateTaskKeys", () => {
  it("derives a keyPrefix for a legacy project and assigns taskNumbers ordered by createdAt", async () => {
    const { org, owner } = await createOrgAndOwner();
    const projectId = await insertLegacyProject(org, owner, "Project Camp");
    await insertLegacyTask(projectId, owner, "Oldest", new Date("2026-01-01"));
    await insertLegacyTask(projectId, owner, "Newest", new Date("2026-02-01"));
    await insertLegacyTask(projectId, owner, "Middle", new Date("2026-01-15"));

    await migrateTaskKeys();

    const project = await Project.findById(projectId);
    expect(project.keyPrefix).toMatch(/^[A-Z]{2,6}$/);
    expect(project.taskCounter).toBe(3);

    const tasks = await Task.find({ project: projectId }).sort({ createdAt: 1 });
    expect(tasks.map((t) => t.taskNumber)).toEqual([1, 2, 3]);
    expect(tasks[0].title).toBe("Oldest");
    expect(tasks[2].title).toBe("Newest");
  });

  it("collision-suffixes derived prefixes that clash within the same org", async () => {
    const { org, owner } = await createOrgAndOwner();
    const idA = await insertLegacyProject(org, owner, "Project Camp");
    const idB = await insertLegacyProject(org, owner, "Project Camp Two");

    await migrateTaskKeys();

    const [projectA, projectB] = await Promise.all([
      Project.findById(idA),
      Project.findById(idB),
    ]);
    expect(projectA.keyPrefix).not.toBe(projectB.keyPrefix);
  });

  it("is idempotent — a second run skips projects/tasks that already have keys", async () => {
    const { org, owner } = await createOrgAndOwner();
    const projectId = await insertLegacyProject(org, owner, "Project Camp");
    await insertLegacyTask(projectId, owner, "Only task", new Date("2026-01-01"));

    await migrateTaskKeys();
    const firstPrefix = (await Project.findById(projectId)).keyPrefix;
    const firstTaskNumber = (
      await Task.findOne({ project: projectId })
    ).taskNumber;

    await migrateTaskKeys();
    const secondPrefix = (await Project.findById(projectId)).keyPrefix;
    const secondTaskNumber = (
      await Task.findOne({ project: projectId })
    ).taskNumber;

    expect(secondPrefix).toBe(firstPrefix);
    expect(secondTaskNumber).toBe(firstTaskNumber);
  });

  it("skips a project that already has a keyPrefix set", async () => {
    const { org, owner } = await createOrgAndOwner();
    const project = await Project.create({
      name: "Already Migrated",
      keyPrefix: "AM",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    await migrateTaskKeys();

    const refreshed = await Project.findById(project._id);
    expect(refreshed.keyPrefix).toBe("AM");
  });

  it("skips a task that already has a taskNumber, even mid-project", async () => {
    const { org, owner } = await createOrgAndOwner();
    const projectId = await insertLegacyProject(org, owner, "Project Camp");
    const alreadyDoneId = await insertLegacyTask(
      projectId,
      owner,
      "Already numbered",
      new Date("2026-01-01"),
    );
    await Task.updateOne({ _id: alreadyDoneId }, { $set: { taskNumber: 99 } });
    await insertLegacyTask(projectId, owner, "Not numbered", new Date("2026-01-02"));

    await migrateTaskKeys();

    const already = await Task.findById(alreadyDoneId);
    expect(already.taskNumber).toBe(99); // untouched

    const project = await Project.findById(projectId);
    // taskCounter must be set past the highest EXISTING number (99), not
    // just past however many tasks this run assigned, or the next real
    // task created via the app would collide with taskNumber 99.
    expect(project.taskCounter).toBeGreaterThanOrEqual(99);
  });
});
