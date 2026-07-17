// backend/src/services/github-app-config.js
//
// Shared, process-wide singletons for the GitHub App integration: the token
// cache (Phase 2.3) and env-derived config. Deliberately NOT added to
// validate-env.js's required lists — the GitHub App integration is
// additive/optional, so a deployment that doesn't use it yet must still
// start up cleanly. Each integration route checks isGithubAppConfigured()
// itself and fails loudly (503), not silently, when it's actually invoked
// without the env vars set.

import Redis from "ioredis";
import { createInMemoryTokenCache } from "./token-cache.js";
import { createRedisTokenCache } from "./redis-token-cache.js";

// Redis when REDIS_URL is set, in-memory fallback otherwise — same
// additive/optional posture as the GitHub App config itself: a deployment
// that hasn't provisioned Redis yet must still start up cleanly, just with
// the in-memory cache's known limitation (per-process only, cold on
// restart). One shared client for both caches, distinguished by key prefix
// (`gh:tok:` vs `gh:install-state:`) — no need for two connections.
function createSharedCache() {
  if (!process.env.REDIS_URL) {
    return { token: createInMemoryTokenCache(), installState: createInMemoryTokenCache() };
  }
  const client = new Redis(process.env.REDIS_URL);
  // Without this listener, ioredis's default behavior on a connection error
  // is an unhandled 'error' event, which crashes the process — the same
  // "fail loudly at the point of use, not silently at startup" posture this
  // module already uses for missing GitHub App env vars applies here too.
  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  const cache = createRedisTokenCache(client);
  return { token: cache, installState: cache };
}

const { token, installState } = createSharedCache();
export const tokenCache = token;
export const installStateCache = installState;

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
