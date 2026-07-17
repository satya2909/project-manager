// backend/src/services/github-app.service.js
//
// Phase 2.3 (plans/ai-dod-plan.md) — App JWT signing + installation token
// minting/caching. This is deliberately the ONLY module that knows how to
// authenticate as the GitHub App — the seam future GitLab/Bitbucket support
// would replace (plans/ai-dod-plan.md's Deferred table).

import jwt from "jsonwebtoken";

const GITHUB_API_BASE = "https://api.github.com";

// Short-lived (<=10 min per GitHub's own limit) — iat backdated 60s to
// tolerate clock drift between this server and GitHub's, a documented
// GitHub App gotcha (a JWT with iat in the future is rejected outright).
export function signAppJwt({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    },
    privateKey,
    { algorithm: "RS256" },
  );
}

// Installation access tokens expire in 1 hour — this is why a cache exists
// at all, not a nice-to-have. TTL is set to the token's real expiry minus a
// 5-minute safety margin, so a request that starts just before expiry
// doesn't get a token that dies mid-flight.
export async function getInstallationToken({
  installationId,
  cache,
  appId,
  privateKey,
  fetchImpl = fetch,
  forceRefresh = false,
}) {
  const cacheKey = `gh:tok:${installationId}`;

  if (!forceRefresh) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const appJwt = signAppJwt({ appId, privateKey });
  const res = await fetchImpl(
    `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub installation token mint failed (${res.status}): ${body}`,
    );
  }

  const { token, expires_at } = await res.json();
  const ttlMs = Math.max(new Date(expires_at).getTime() - Date.now() - 5 * 60_000, 0);
  await cache.set(cacheKey, token, ttlMs);
  return token;
}

// Repos available to this installation — feeds the repo picker (Phase 2.7)
// and the bind-time "does this repo actually belong to the org's
// installation" check (project.controllers.js).
export async function listInstallationRepositories({
  installationId,
  cache,
  appId,
  privateKey,
  fetchImpl = fetch,
}) {
  const token = await getInstallationToken({
    installationId,
    cache,
    appId,
    privateKey,
    fetchImpl,
  });

  const res = await fetchImpl(`${GITHUB_API_BASE}/installation/repositories`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub repository list failed (${res.status}): ${body}`);
  }

  const { repositories } = await res.json();
  return repositories.map((r) => ({
    githubId: r.id,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
  }));
}
