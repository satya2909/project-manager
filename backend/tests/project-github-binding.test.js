import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User, Organization, Project, GithubInstallation } from "../src/models/index.js";
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

async function createInstallation(org, owner, repos) {
  return GithubInstallation.create({
    organization: org._id,
    installationId: 999,
    accountLogin: "acme",
    installedBy: owner._id,
    repositories: repos,
  });
}

describe("PUT /api/v1/projects/:projectId/github — bind repo", () => {
  it("binds a repo that belongs to the org's installation", async () => {
    const { org, owner } = await createOrg();
    await createInstallation(org, owner, [
      { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
    ]);
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .put(`/api/v1/projects/${project._id}/github`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ githubId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.project.githubRepo).toEqual({
      githubId: 1,
      fullName: "acme/widgets",
      defaultBranch: "main",
    });
  });

  it("404s if the org has no GitHub App installation at all", async () => {
    const { org, owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .put(`/api/v1/projects/${project._id}/github`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ githubId: 1 });

    expect(res.status).toBe(404);
  });

  it("400s if the repo doesn't belong to this org's installation", async () => {
    const { org, owner } = await createOrg();
    await createInstallation(org, owner, [
      { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
    ]);
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .put(`/api/v1/projects/${project._id}/github`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ githubId: 999 }); // not in the installation's repo list

    expect(res.status).toBe(400);
  });

  it("409s if the repo is already bound to a different project (1:1)", async () => {
    const { org, owner } = await createOrg();
    await createInstallation(org, owner, [
      { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
    ]);
    await Project.create({
      name: "Already Bound",
      keyPrefix: "AB",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
      githubRepo: { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
    });
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
    });

    const res = await request(app)
      .put(`/api/v1/projects/${project._id}/github`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ githubId: 1 });

    expect(res.status).toBe(409);
  });

  it("403s for a plain project member (project-admin gated)", async () => {
    const { org, owner } = await createOrg();
    await createInstallation(org, owner, [
      { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
    ]);
    const member = await User.create({
      username: "member1",
      email: "member1@example.com",
      fullName: "Member",
      password: "password123",
      organization: org._id,
      role: OrgRolesEnum.MEMBER,
      isEmailVerified: true,
    });
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [
        { user: owner._id, role: "admin" },
        { user: member._id, role: "member" },
      ],
    });

    const res = await request(app)
      .put(`/api/v1/projects/${project._id}/github`)
      .set("Authorization", `Bearer ${tokenFor(member)}`)
      .send({ githubId: 1 });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/v1/projects/:projectId/github — unbind repo", () => {
  it("clears the project's githubRepo", async () => {
    const { org, owner } = await createOrg();
    const project = await Project.create({
      name: "Project Camp",
      keyPrefix: "CAMP",
      organization: org._id,
      createdBy: owner._id,
      members: [{ user: owner._id, role: "admin" }],
      githubRepo: { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
    });

    const res = await request(app)
      .delete(`/api/v1/projects/${project._id}/github`)
      .set("Authorization", `Bearer ${tokenFor(owner)}`);

    expect(res.status).toBe(200);
    const refreshed = await Project.findById(project._id);
    expect(refreshed.githubRepo).toBeNull();
  });
});
