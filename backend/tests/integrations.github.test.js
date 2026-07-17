import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { generateKeyPairSync } from "crypto";
import app from "../src/app.js";
import { User, Organization, Project, GithubInstallation } from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";

vi.mock("../src/services/github-app.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listInstallationRepositories: vi.fn().mockResolvedValue([
      { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
    ]),
  };
});

const { listInstallationRepositories } = await import(
  "../src/services/github-app.service.js"
);

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

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

function setConfigured() {
  process.env.GITHUB_APP_ID = "12345";
  process.env.GITHUB_APP_PRIVATE_KEY = privateKey;
  process.env.GITHUB_APP_CLIENT_ID = "client-id";
  process.env.GITHUB_APP_CLIENT_SECRET = "client-secret";
  process.env.GITHUB_APP_SLUG = "project-camp-dod";
}

function clearConfigured() {
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  delete process.env.GITHUB_APP_CLIENT_ID;
  delete process.env.GITHUB_APP_CLIENT_SECRET;
  delete process.env.GITHUB_APP_SLUG;
}

describe("GitHub App integration routes", () => {
  afterEach(() => {
    clearConfigured();
    vi.clearAllMocks();
  });

  describe("when not configured", () => {
    it("503s on install-url", async () => {
      const { owner } = await createOrg();
      const res = await request(app)
        .get("/api/v1/integrations/github/install-url")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);
      expect(res.status).toBe(503);
    });
  });

  describe("when configured", () => {
    beforeEach(setConfigured);

    it("GET install-url returns a URL containing the app slug and a state param", async () => {
      const { owner } = await createOrg();
      const res = await request(app)
        .get("/api/v1/integrations/github/install-url")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.url).toContain("github.com/apps/project-camp-dod/installations/new");
      expect(res.body.data.url).toContain("state=");
    });

    it("403s install-url for a plain member (org-owner gated)", async () => {
      const { org } = await createOrg();
      const member = await User.create({
        username: "member1",
        email: "member1@example.com",
        fullName: "Member",
        password: "password123",
        organization: org._id,
        role: OrgRolesEnum.MEMBER,
        isEmailVerified: true,
      });

      const res = await request(app)
        .get("/api/v1/integrations/github/install-url")
        .set("Authorization", `Bearer ${tokenFor(member)}`);

      expect(res.status).toBe(403);
    });

    it("full round trip: install-url state -> callback creates the installation", async () => {
      const { owner } = await createOrg();

      const urlRes = await request(app)
        .get("/api/v1/integrations/github/install-url")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);
      const state = new URL(urlRes.body.data.url).searchParams.get("state");

      const callbackRes = await request(app)
        .get("/api/v1/integrations/github/callback")
        .query({ installation_id: "999", state })
        .set("Authorization", `Bearer ${tokenFor(owner)}`);

      expect(callbackRes.status).toBe(200);
      expect(callbackRes.body.data.installation.installationId).toBe(999);
      expect(callbackRes.body.data.installation.accountLogin).toBe("acme");

      const stored = await GithubInstallation.findOne({ organization: owner.organization });
      expect(stored.installationId).toBe(999);
    });

    it("rejects a callback whose state belongs to a different organization", async () => {
      const { owner: ownerA } = await createOrg();
      const { owner: ownerB } = await createOrg();

      const urlRes = await request(app)
        .get("/api/v1/integrations/github/install-url")
        .set("Authorization", `Bearer ${tokenFor(ownerA)}`);
      const state = new URL(urlRes.body.data.url).searchParams.get("state");

      const callbackRes = await request(app)
        .get("/api/v1/integrations/github/callback")
        .query({ installation_id: "999", state })
        .set("Authorization", `Bearer ${tokenFor(ownerB)}`);

      expect(callbackRes.status).toBe(403);
    });

    it("rejects a replayed callback state (single-use)", async () => {
      const { owner } = await createOrg();
      const urlRes = await request(app)
        .get("/api/v1/integrations/github/install-url")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);
      const state = new URL(urlRes.body.data.url).searchParams.get("state");

      await request(app)
        .get("/api/v1/integrations/github/callback")
        .query({ installation_id: "999", state })
        .set("Authorization", `Bearer ${tokenFor(owner)}`);

      const replay = await request(app)
        .get("/api/v1/integrations/github/callback")
        .query({ installation_id: "999", state })
        .set("Authorization", `Bearer ${tokenFor(owner)}`);

      expect(replay.status).toBe(400);
    });

    it("GET /github returns connected:false when nothing is installed", async () => {
      const { owner } = await createOrg();
      const res = await request(app)
        .get("/api/v1/integrations/github")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.connected).toBe(false);
    });

    it("GET /github returns connected:true + repositories when installed", async () => {
      const { org, owner } = await createOrg();
      await GithubInstallation.create({
        organization: org._id,
        installationId: 999,
        accountLogin: "acme",
        installedBy: owner._id,
      });

      const res = await request(app)
        .get("/api/v1/integrations/github")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.connected).toBe(true);
      expect(res.body.data.repositories).toEqual([
        { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
      ]);
    });

    it("DELETE /github removes the installation and unsets githubRepo on every project", async () => {
      const { org, owner } = await createOrg();
      await GithubInstallation.create({
        organization: org._id,
        installationId: 999,
        accountLogin: "acme",
        installedBy: owner._id,
      });
      const project = await Project.create({
        name: "Bound Project",
        keyPrefix: "BP",
        organization: org._id,
        createdBy: owner._id,
        members: [{ user: owner._id, role: "admin" }],
        githubRepo: { fullName: "acme/widgets", githubId: 1, defaultBranch: "main" },
      });

      const res = await request(app)
        .delete("/api/v1/integrations/github")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);

      expect(res.status).toBe(200);
      expect(await GithubInstallation.findOne({ organization: org._id })).toBeNull();
      const refreshed = await Project.findById(project._id);
      expect(refreshed.githubRepo).toBeNull();
    });

    it("404s disconnect when nothing is installed", async () => {
      const { owner } = await createOrg();
      const res = await request(app)
        .delete("/api/v1/integrations/github")
        .set("Authorization", `Bearer ${tokenFor(owner)}`);
      expect(res.status).toBe(404);
    });
  });
});
