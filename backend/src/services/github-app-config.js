// backend/src/services/github-app-config.js
//
// Shared, process-wide singletons for the GitHub App integration: the token
// cache (Phase 2.3) and env-derived config. Deliberately NOT added to
// validate-env.js's required lists — the GitHub App integration is
// additive/optional, so a deployment that doesn't use it yet must still
// start up cleanly. Each integration route checks isGithubAppConfigured()
// itself and fails loudly (503), not silently, when it's actually invoked
// without the env vars set.

import { createInMemoryTokenCache } from "./token-cache.js";

export const tokenCache = createInMemoryTokenCache();
export const installStateCache = createInMemoryTokenCache();

export function getGithubAppConfig() {
  return {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    appSlug: process.env.GITHUB_APP_SLUG,
    stateSecret: process.env.GITHUB_APP_CLIENT_SECRET, // reuse — no separate secret to manage
  };
}

export function isGithubAppConfigured() {
  const { appId, privateKey, appSlug, stateSecret } = getGithubAppConfig();
  return Boolean(appId && privateKey && appSlug && stateSecret);
}
