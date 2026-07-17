// backend/src/dod/github/installation-auth.js
//
// Shared by every node that calls the GitHub API on behalf of an
// installation (5-fetchDiff, 6-searchRepo, 7-readFiles) — each needs the
// same owner/repo split and a minted installation token. Extracted so the
// three nodes don't each repeat the same appId/privateKey/token-mint block.

import { getInstallationToken as defaultGetInstallationToken } from "../../services/github-app.service.js";
import { tokenCache, getGithubAppConfig } from "../../services/github-app-config.js";

export async function getRepoAndToken(state, { getInstallationToken = defaultGetInstallationToken } = {}) {
  const { appId, privateKey } = getGithubAppConfig();
  const [owner, repo] = state.repo.fullName.split("/");

  const token = await getInstallationToken({
    installationId: state.repo.installationId,
    cache: tokenCache,
    appId,
    privateKey,
  });

  return { owner, repo, token };
}
