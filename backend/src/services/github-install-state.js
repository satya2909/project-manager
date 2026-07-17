// backend/src/services/github-install-state.js
//
// Phase 2.4 (plans/ai-dod-plan.md) — the `state` param round-tripped through
// GitHub during the App install flow. Signed AND single-use: an HMAC alone
// is replayable within its TTL (found in /plan-ceo-review, 2026-07-17) — an
// intercepted state could otherwise be reused by an attacker with a
// different installation_id to link their GitHub account to this org.
// Consumption is tracked in `cache` (the same interface as the token cache;
// `del` gives single-use semantics here) so a state only ever verifies once.

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const DEFAULT_TTL_MS = 10 * 60_000; // 10 minutes

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function createInstallState({
  organizationId,
  secret,
  cache,
  ttlMs = DEFAULT_TTL_MS,
}) {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + ttlMs;
  const payload = `${nonce}.${organizationId}.${expiresAt}`;
  const signature = sign(payload, secret);
  const state = `${payload}.${signature}`;

  // Mark this nonce as "issued, not yet consumed" — consumeInstallState
  // deletes it on first (and only) successful use.
  await cache.set(`gh:install-state:${nonce}`, true, ttlMs);

  return state;
}

export async function consumeInstallState({ state, secret, cache }) {
  const parts = (state || "").split(".");
  if (parts.length !== 4) {
    throw new Error("Invalid install state");
  }
  const [nonce, organizationId, expiresAtStr, signature] = parts;
  const payload = `${nonce}.${organizationId}.${expiresAtStr}`;
  const expected = sign(payload, secret);

  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(signature, "hex");
  const validSignature =
    expectedBuf.length === gotBuf.length && timingSafeEqual(expectedBuf, gotBuf);

  if (!validSignature) {
    throw new Error("Invalid install state");
  }

  if (Date.now() > Number(expiresAtStr)) {
    throw new Error("Install state expired");
  }

  const cacheKey = `gh:install-state:${nonce}`;
  const stillValid = await cache.get(cacheKey);
  if (!stillValid) {
    throw new Error("Install state already used or not found");
  }
  await cache.del(cacheKey);

  return { organizationId };
}
