// backend/src/queue/dod-queue-instance.js
//
// Process-wide singleton so the webhook controller (enqueue) and the worker
// (process) share the same queue. In-process implementation — see
// dod-queue.js's header comment for the Redis/BullMQ migration path.

import { createInProcessDodQueue } from "./dod-queue.js";

// Debounce delay is shortened in tests (set by backend/tests/setup.js) so
// end-to-end queue tests don't burn 30 real seconds each — the mechanism
// under test (debounce, dedup, fencing) doesn't depend on the exact delay
// value, only that one exists.
const delayMs = process.env.NODE_ENV === "test" ? 400 : 30_000;

export const dodQueue = createInProcessDodQueue({
  delayMs,
  attempts: 3,
  backoffMs: 5_000,
});
