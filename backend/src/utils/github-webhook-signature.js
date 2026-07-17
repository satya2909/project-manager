// backend/src/utils/github-webhook-signature.js
//
// Phase 3.1 (plans/ai-dod-plan.md) — verifies GitHub's X-Hub-Signature-256
// header. Invalid signature -> 401, no further processing. Must be computed
// over the RAW request body bytes, before any JSON parsing — see the route
// wiring in webhook.routes.js (express.raw() ahead of express.json()).

import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSignature({ body, signature, secret }) {
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(signature);

  return expectedBuf.length === gotBuf.length && timingSafeEqual(expectedBuf, gotBuf);
}
