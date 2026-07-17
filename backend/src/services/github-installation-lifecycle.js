// backend/src/services/github-installation-lifecycle.js
//
// Phase 2.5 / Phase 3 (plans/ai-dod-plan.md) — installation lifecycle events.
// Written in Phase 2 as logic, wired to a real (public, unauthenticated)
// webhook for the first time in Phase 3 — see webhook.controllers.js.

import { GithubInstallation, Project } from "../models/index.js";

export async function handleInstallationEvent(payload) {
  const installationId = payload.installation?.id;
  if (!installationId) return;

  if (payload.action === "deleted") {
    const installation = await GithubInstallation.findOneAndUpdate(
      { installationId },
      { $set: { status: "deleted" } },
      { new: true },
    );
    if (installation) {
      await Project.updateMany(
        { organization: installation.organization },
        { $unset: { githubRepo: "" } },
      );
    }
    return;
  }

  if (payload.action === "suspend") {
    await GithubInstallation.updateOne({ installationId }, { $set: { status: "suspended" } });
    return;
  }

  if (payload.action === "unsuspend") {
    await GithubInstallation.updateOne({ installationId }, { $set: { status: "active" } });
    return;
  }
  // 'created'/'new_permissions_accepted' etc. — no-op; the installation
  // itself is created by the callback flow (Phase 2.4), not this webhook.
}

export async function handleInstallationRepositoriesEvent(payload) {
  const installationId = payload.installation?.id;
  if (!installationId) return;

  const installation = await GithubInstallation.findOne({ installationId });
  if (!installation) return;

  const added = (payload.repositories_added ?? []).map((r) => ({
    githubId: r.id,
    fullName: r.full_name,
    defaultBranch: r.default_branch ?? "main",
  }));
  const removedIds = new Set((payload.repositories_removed ?? []).map((r) => r.id));

  const nextRepos = [
    ...installation.repositories.filter((r) => !removedIds.has(r.githubId)),
    ...added,
  ];

  await GithubInstallation.updateOne(
    { installationId },
    { $set: { repositories: nextRepos } },
  );
}
