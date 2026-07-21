import { GithubInstallation, Project } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  getGithubAppConfig,
  isGithubAppConfigured,
  tokenCache,
  installStateCache,
} from "../services/github-app-config.js";
import {
  createInstallState,
  consumeInstallState,
} from "../services/github-install-state.js";
import { listInstallationRepositories } from "../services/github-app.service.js";

function assertConfigured() {
  if (!isGithubAppConfigured()) {
    throw new ApiError(
      503,
      "GitHub App integration is not configured on this deployment yet",
    );
  }
}

// ─── GET /integrations/github/install-url ──────────────────────────────────────
export const getInstallUrl = asyncHandler(async (req, res) => {
  assertConfigured();
  const { appSlug, stateSecret } = getGithubAppConfig();

  const state = await createInstallState({
    organizationId: req.user.organization.toString(),
    secret: stateSecret,
    cache: installStateCache,
  });

  const url = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;

  return res
    .status(200)
    .json(new ApiResponses(200, { url }, "Install URL generated"));
});

// ─── GET /integrations/github/callback ─────────────────────────────────────────
// GitHub redirects the browser here in two distinct cases (same Setup URL,
// "Redirect on update" checked):
//   1. A fresh install started from OUR "Connect GitHub" button — carries
//      both installation_id and the state token minted by getInstallUrl.
//      The state is what ties this installation to a specific org.
//   2. A repo-access change made directly on GitHub's own installation
//      settings page (not through this app) — carries installation_id and
//      setup_action=update, but no state, since no install flow here
//      originated it. Since nothing is being newly bound to an org here,
//      org ownership is instead verified by requiring the installation to
//      already belong to the caller's org in our own DB.
export const githubCallback = asyncHandler(async (req, res) => {
  assertConfigured();
  const { installation_id: installationId, state, setup_action: setupAction } = req.query;

  if (!installationId) {
    throw new ApiError(400, "Missing installation_id");
  }

  const { appId, privateKey } = getGithubAppConfig();
  let organizationId;

  if (state) {
    const { stateSecret } = getGithubAppConfig();
    ({ organizationId } = await consumeInstallState({
      state,
      secret: stateSecret,
      cache: installStateCache,
    }).catch(() => {
      throw new ApiError(400, "Invalid or expired install state");
    }));
  } else if (setupAction === "update") {
    const existing = await GithubInstallation.findOne({
      installationId: Number(installationId),
    }).lean();
    if (!existing) {
      throw new ApiError(404, "No known installation to update — connect GitHub from Project Camp first");
    }
    organizationId = existing.organization.toString();
  } else {
    throw new ApiError(400, "Missing state");
  }

  if (organizationId !== req.user.organization.toString()) {
    throw new ApiError(403, "Installation does not belong to your organization");
  }

  // Fetch the account login for display — best-effort, don't fail the
  // whole install if this one read fails (the installation itself is
  // already valid at this point; a decorative field isn't worth blocking).
  let accountLogin = "unknown";
  try {
    const repos = await listInstallationRepositories({
      installationId: Number(installationId),
      cache: tokenCache,
      appId,
      privateKey,
    });
    accountLogin = repos[0]?.fullName?.split("/")[0] ?? accountLogin;
  } catch {
    /* non-fatal — see comment above */
  }

  await GithubInstallation.findOneAndUpdate(
    { organization: req.user.organization },
    {
      organization: req.user.organization,
      installationId: Number(installationId),
      accountLogin,
      status: "active",
      installedBy: req.user._id,
    },
    { upsert: true, new: true },
  );

  // GitHub redirects the *browser* here — a raw JSON response would just
  // dump API output in the tab instead of landing the user back in the app.
  // The installation above is already saved by this point regardless of
  // whether this redirect succeeds.
  return res.redirect(`${process.env.CLIENT_URL}/organization?tab=integrations&github=connected`);
});

// ─── GET /integrations/github ──────────────────────────────────────────────────
export const getInstallStatus = asyncHandler(async (req, res) => {
  const installation = await GithubInstallation.findOne({
    organization: req.user.organization,
  }).lean();

  if (!installation) {
    return res
      .status(200)
      .json(new ApiResponses(200, { connected: false }, "Not connected"));
  }

  let repositories = [];
  if (isGithubAppConfigured()) {
    const { appId, privateKey } = getGithubAppConfig();
    try {
      repositories = await listInstallationRepositories({
        installationId: installation.installationId,
        cache: tokenCache,
        appId,
        privateKey,
      });
    } catch (err) {
      // A transient GitHub API failure shouldn't break the whole settings
      // page — surface the connection as active with an empty repo list
      // rather than 500ing.
      console.error("[integrations] failed to list repositories:", err.message);
    }
  }

  return res.status(200).json(
    new ApiResponses(
      200,
      { connected: true, installation, repositories },
      "GitHub App status",
    ),
  );
});

// ─── DELETE /integrations/github ───────────────────────────────────────────────
export const disconnectInstallation = asyncHandler(async (req, res) => {
  const installation = await GithubInstallation.findOneAndDelete({
    organization: req.user.organization,
  });

  if (!installation) {
    throw new ApiError(404, "No GitHub App installation connected");
  }

  await Project.updateMany(
    { organization: req.user.organization },
    { $unset: { githubRepo: "" } },
  );

  return res
    .status(200)
    .json(new ApiResponses(200, {}, "GitHub App disconnected"));
});
