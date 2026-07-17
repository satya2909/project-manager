// backend/src/services/webhook-resolve.js
//
// Phase 3.1 (plans/ai-dod-plan.md) — the §4.1 resolution chain. Every lookup
// is scoped by the previously resolved parent; a task key is never resolved
// globally. Fails closed at every link — the caller (webhook.controllers.js)
// treats any `miss` as "200 + log", never a cross-project lookup and never
// a 4xx/5xx for a benign miss (GitHub disables webhooks that keep erroring).

import { GithubInstallation, Project, Task } from "../models/index.js";
import { parseTaskKey } from "../utils/task-key-parser.js";

export async function resolveWebhookContext({
  installationId,
  repoGithubId,
  branch,
  prTitle,
  prBody,
}) {
  const installation = await GithubInstallation.findOne({
    installationId,
    status: { $ne: "deleted" },
  });
  if (!installation) return { miss: "unknown_installation" };

  const project = await Project.findOne({
    organization: installation.organization,
    "githubRepo.githubId": repoGithubId,
  });
  if (!project) return { miss: "unbound_repo" };

  const parsed = parseTaskKey({ branch, prTitle, prBody }, project);
  if (!parsed) return { miss: "no_task_key" };

  const task = await Task.findOne({
    project: project._id,
    taskNumber: parsed.taskNumber,
  });
  if (!task) return { miss: "task_not_found" };

  return { organizationId: installation.organization, project, task };
}
