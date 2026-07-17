// backend/src/controllers/webhook.controllers.js
//
// Phase 3.1 (plans/ai-dod-plan.md) — the public, unauthenticated GitHub
// webhook. Order of operations, fixed: verify signature (401 on failure) ->
// parse -> route by X-GitHub-Event -> resolve the §4.1 chain, failing closed
// at every link -> enqueue -> return 202 immediately. Everything after
// signature verification that misses returns 200 + log, NEVER a 4xx/5xx —
// GitHub disables webhooks that keep erroring on benign misses.

import { Task, AiEvaluationLog, Activity } from "../models/index.js";
import { verifyWebhookSignature } from "../utils/github-webhook-signature.js";
import { getGithubAppConfig } from "../services/github-app-config.js";
import { resolveWebhookContext } from "../services/webhook-resolve.js";
import { shouldEvaluate } from "../utils/webhook-trigger.js";
import {
  handleInstallationEvent,
  handleInstallationRepositoriesEvent,
} from "../services/github-installation-lifecycle.js";
import { dodQueue } from "../queue/dod-queue-instance.js";
import { asyncHandler } from "../utils/async-handler.js";

// asyncHandler matters here specifically: if enqueue() throws (e.g. a future
// Redis-backed queue is unreachable), that must reach Express's error
// handler and produce a 5xx — GitHub then retries the delivery automatically
// (plans/PRD_v2.md §7.3). An unwrapped async function would instead produce
// an unhandled rejection, not a 5xx.
export const githubWebhook = asyncHandler(async (req, res) => {
  const { webhookSecret } = getGithubAppConfig();
  const signature = req.headers["x-hub-signature-256"];

  if (!webhookSecret || !verifyWebhookSignature({ body: req.rawBody, signature, secret: webhookSecret })) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = req.headers["x-github-event"];
  const payload = req.body;

  if (event === "push") {
    return res.status(200).json({ message: "Webhook ignored: push events are not evaluated" });
  }

  if (event === "installation") {
    await handleInstallationEvent(payload);
    return res.status(200).json({ message: "Installation event processed" });
  }

  if (event === "installation_repositories") {
    await handleInstallationRepositoriesEvent(payload);
    return res.status(200).json({ message: "Repository list refreshed" });
  }

  if (event !== "pull_request") {
    return res.status(200).json({ message: `Webhook ignored: unhandled event ${event}` });
  }

  const pr = payload.pull_request;
  const context = await resolveWebhookContext({
    installationId: payload.installation?.id,
    repoGithubId: payload.repository?.id,
    branch: pr?.head?.ref,
    prTitle: pr?.title,
    prBody: pr?.body,
  });

  if (context.miss) {
    return res.status(200).json({ message: `Webhook ignored: ${context.miss}` });
  }

  const { organizationId, project, task } = context;

  // Cancel any waiting job and reset pending -> none. Never leave an
  // orphaned spinner (plans/ai-dod-plan.md §3.2b).
  if (payload.action === "converted_to_draft") {
    dodQueue.cancelWaiting(task._id.toString());
    if (task.aiLockStatus === "pending") {
      await Task.updateOne({ _id: task._id }, { $set: { aiLockStatus: "none" } });
    }
    return res.status(200).json({ message: "Draft — cancelled any pending evaluation" });
  }

  // Merged while blocked: freeze the verdict, zero LLM calls, log it. This
  // may be more valuable than the gate itself — it's the exact information
  // asymmetry this feature exists to close (plans/ai-dod-plan.md §6.5).
  if (payload.action === "closed" && pr?.merged) {
    if (task.aiLockStatus === "blocked") {
      await AiEvaluationLog.create({
        organization: organizationId,
        project: project._id,
        task: task._id,
        evaluationSeq: task.evaluationSeq,
        headSha: pr.head?.sha ?? "unknown",
        trigger: "merge",
        status: "SKIPPED",
      });
      await Activity.create({
        project: project._id,
        action: "ai_dod_merged_unevidenced",
        target: task.title,
      });
    }
    return res.status(200).json({ message: "Merged — verdict frozen if blocked" });
  }

  if (!shouldEvaluate("pull_request", payload)) {
    return res.status(200).json({ message: "Webhook ignored: not an evaluatable action" });
  }

  // Bump evaluationSeq on enqueue (not completion) — completion order isn't
  // issue order under unpredictable LLM latency (PRD §5.6).
  const updated = await Task.findOneAndUpdate(
    { _id: task._id },
    { $inc: { evaluationSeq: 1 }, $set: { aiLockStatus: "pending" } },
    { new: true },
  );

  dodQueue.enqueue({
    taskId: task._id.toString(),
    headSha: pr.head?.sha,
    payload: {
      organizationId,
      projectId: project._id,
      taskId: task._id,
      evaluationSeq: updated.evaluationSeq,
      headSha: pr.head?.sha,
      trigger: "pull_request",
    },
  });

  return res.status(202).json({ message: "Enqueued" });
});
