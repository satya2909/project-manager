import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createHmac } from "crypto";
import app from "../src/app.js";
import {
  User,
  Organization,
  Project,
  Task,
  GithubInstallation,
  AiEvaluationLog,
  Activity,
} from "../src/models/index.js";
import { OrgRolesEnum } from "../src/utils/constants.js";
import { dodQueue } from "../src/queue/dod-queue-instance.js";
// Registers the stub processor + final-failure handler on the shared queue.
import "../src/workers/dod.worker.js";

const WEBHOOK_SECRET = "test-webhook-secret";

function setConfigured() {
  process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
}
function clearConfigured() {
  delete process.env.GITHUB_WEBHOOK_SECRET;
}

function sendWebhook({ event, payload, secret = WEBHOOK_SECRET }) {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return request(app)
    .post("/api/v1/integrations/github/webhook")
    .set("Content-Type", "application/json")
    .set("X-GitHub-Event", event)
    .set("X-Hub-Signature-256", signature)
    .send(body);
}

let orgCounter = 0;

async function setup({ installationId = 999, repoGithubId = 111 } = {}) {
  orgCounter += 1;
  const org = await Organization.create({
    name: `Org ${orgCounter}`,
    slug: `org-${orgCounter}`,
    createdBy: new mongoose.Types.ObjectId(),
  });
  const owner = await User.create({
    username: `owner${orgCounter}`,
    email: `owner${orgCounter}@example.com`,
    fullName: "Owner",
    password: "password123",
    organization: org._id,
    role: OrgRolesEnum.OWNER,
    isEmailVerified: true,
  });
  const installation = await GithubInstallation.create({
    organization: org._id,
    installationId,
    accountLogin: "acme",
    installedBy: owner._id,
  });
  const project = await Project.create({
    name: "Project Camp",
    keyPrefix: "CAMP",
    organization: org._id,
    createdBy: owner._id,
    members: [{ user: owner._id, role: "admin" }],
    githubRepo: { githubId: repoGithubId, fullName: "acme/widgets", defaultBranch: "main" },
  });
  const task = await Task.create({
    title: "Add refresh token",
    project: project._id,
    createdBy: owner._id,
    taskNumber: 104,
  });
  return { org, owner, project, task, installation };
}

function prPayload({ installationId, repoGithubId, action, draft = false, merged = false, branch = "feature/CAMP-104-x", changes }) {
  return {
    action,
    installation: { id: installationId },
    repository: { id: repoGithubId, full_name: "acme/widgets" },
    pull_request: {
      draft,
      merged,
      title: "Some PR",
      body: "",
      head: { ref: branch, sha: `sha-${Math.random().toString(36).slice(2)}` },
    },
    ...(changes ? { changes } : {}),
  };
}

describe("POST /api/v1/integrations/github/webhook", () => {
  beforeEach(setConfigured);
  afterEach(clearConfigured);

  it("401s on a bad signature", async () => {
    await setup();
    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "opened" }),
      secret: "wrong-secret",
    });
    expect(res.status).toBe(401);
  });

  it("200s + logs (no writes) for push — push is never evaluated", async () => {
    await setup();
    const res = await sendWebhook({ event: "push", payload: { ref: "refs/heads/main" } });
    expect(res.status).toBe(200);
    expect(await AiEvaluationLog.countDocuments({})).toBe(0);
  });

  it("200s + no writes for an unknown installation", async () => {
    await setup();
    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 555, repoGithubId: 111, action: "opened" }),
    });
    expect(res.status).toBe(200);
    expect(await AiEvaluationLog.countDocuments({})).toBe(0);
  });

  it("200s + no writes for an unbound repo", async () => {
    await setup();
    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 999999, action: "opened" }),
    });
    expect(res.status).toBe(200);
    expect(await AiEvaluationLog.countDocuments({})).toBe(0);
  });

  it("200s + no writes when no task key is present", async () => {
    await setup();
    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "opened", branch: "misc-cleanup" }),
    });
    expect(res.status).toBe(200);
    expect(await AiEvaluationLog.countDocuments({})).toBe(0);
  });

  it("202s + no job for a draft PR opened", async () => {
    const { task } = await setup();
    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "opened", draft: true }),
    });
    expect(res.status).toBe(200); // shouldEvaluate is false for drafts -> falls to the generic "not evaluatable" 200
    expect(dodQueue.hasWaiting(task._id.toString())).toBe(false);
  });

  it("202s + enqueues when a draft is marked ready_for_review", async () => {
    const { task } = await setup();
    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "ready_for_review", draft: false }),
    });
    expect(res.status).toBe(202);
    expect(dodQueue.hasWaiting(task._id.toString())).toBe(true);

    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("pending");
    expect(refreshed.evaluationSeq).toBe(1);
  });

  it("three rapid synchronize deliveries produce exactly one waiting job (debounce)", async () => {
    const { task } = await setup();
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      await sendWebhook({
        event: "pull_request",
        payload: prPayload({ installationId: 999, repoGithubId: 111, action: "synchronize" }),
      });
    }
    expect(dodQueue.hasWaiting(task._id.toString())).toBe(true);
    // evaluationSeq bumps on every enqueue call (each webhook call bumps it,
    // independent of queue-level debounce) — three deliveries -> seq 3.
    const refreshed = await Task.findById(task._id);
    expect(refreshed.evaluationSeq).toBe(3);
  });

  it("converted_to_draft cancels a waiting job and resets pending -> none", async () => {
    const { task } = await setup();
    await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "opened" }),
    });
    expect(dodQueue.hasWaiting(task._id.toString())).toBe(true);

    await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "converted_to_draft", draft: true }),
    });

    expect(dodQueue.hasWaiting(task._id.toString())).toBe(false);
    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("none");
  });

  it("merged while blocked freezes the verdict — zero LLM calls, logs SKIPPED + an Activity entry", async () => {
    const { task, project } = await setup();
    await Task.updateOne({ _id: task._id }, { $set: { aiLockStatus: "blocked", evaluationSeq: 1 } });

    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "closed", merged: true }),
    });

    expect(res.status).toBe(200);
    const log = await AiEvaluationLog.findOne({ task: task._id });
    expect(log.status).toBe("SKIPPED");
    expect(log.trigger).toBe("merge");

    const activity = await Activity.findOne({ project: project._id, action: "ai_dod_merged_unevidenced" });
    expect(activity).not.toBeNull();
    expect(activity.target).toBe(task.title);

    // Verdict frozen — aiLockStatus untouched, still 'blocked'.
    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("blocked");
  });

  it("does not freeze/log anything when merged while NOT blocked (e.g. clear)", async () => {
    const { task } = await setup();
    await Task.updateOne({ _id: task._id }, { $set: { aiLockStatus: "clear" } });

    await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "closed", merged: true }),
    });

    expect(await AiEvaluationLog.countDocuments({ task: task._id })).toBe(0);
    expect(await Activity.countDocuments({ action: "ai_dod_merged_unevidenced" })).toBe(0);
  });

  it("an in-flight branch on a RENAMED prefix still resolves via prefixAliases", async () => {
    const { project, task } = await setup();
    await Project.updateOne(
      { _id: project._id },
      { $set: { keyPrefix: "PC" }, $addToSet: { prefixAliases: "CAMP" } },
    );

    const res = await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "opened", branch: "feature/CAMP-104-x" }),
    });

    expect(res.status).toBe(202);
    expect(dodQueue.hasWaiting(task._id.toString())).toBe(true);
  });

  it("CROSS-TENANT: a webhook for org A's repo naming CAMP-104 cannot touch org B's CAMP-104", async () => {
    await setup({ installationId: 100, repoGithubId: 200 }); // org A
    const { task: taskB } = await setup({ installationId: 101, repoGithubId: 201 }); // org B, same CAMP-104

    await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 101, repoGithubId: 201, action: "opened", branch: "feature/CAMP-104-x" }),
    });

    // Only org B's task should show any change.
    const refreshedB = await Task.findById(taskB._id);
    expect(refreshedB.aiLockStatus).toBe("pending");
    expect(dodQueue.hasWaiting(taskB._id.toString())).toBe(true);
  });

  it("end to end: fails open through the real pipeline when GitHub App / LLM credentials aren't configured", async () => {
    // This test environment has no GITHUB_APP_ID/PRIVATE_KEY or
    // ANTHROPIC_API_KEY configured (deliberately — see backend/tests/setup.js),
    // and network access is stubbed out entirely below. That's the point:
    // a real-world equivalent is "GitHub/the LLM provider is unreachable",
    // and plans/PRD_v2.md §7.3's invariant — no task is ever locked by an
    // infrastructure failure — must hold through the full HTTP -> queue ->
    // pipeline path, not just in each node's own unit test.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("network disabled in test");
    };

    const { task } = await setup();
    await sendWebhook({
      event: "pull_request",
      payload: prPayload({ installationId: 999, repoGithubId: 111, action: "opened" }),
    });
    expect(dodQueue.hasWaiting(task._id.toString())).toBe(true);

    // Test-mode debounce delay is 400ms (see dod-queue-instance.js) — wait
    // past it for the real (non-fake-timer) queue to actually run the job.
    await new Promise((resolve) => setTimeout(resolve, 600));

    globalThis.fetch = originalFetch;

    const refreshed = await Task.findById(task._id);
    expect(refreshed.aiLockStatus).toBe("clear");
    const log = await AiEvaluationLog.findOne({ task: task._id });
    expect(log.status).toBe("PASSED_BY_SYSTEM_ERROR");
    expect(log.errorCode).toBe("LLM_TIMEOUT");
  });
});
