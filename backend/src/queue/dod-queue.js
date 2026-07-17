// backend/src/queue/dod-queue.js
//
// Phase 3.3 (plans/ai-dod-plan.md) — the DoD evaluation queue, behind a
// pluggable interface. In-process today (Node timers + a Map) — per the
// Redis/BullMQ hosting decision still open in TODOS.md, this proves the
// exact semantics Phase 3's review gate cares about (debounce, jobId-style
// dedup, retry/backoff, final-failure) in real automated tests, without
// waiting on infra. Swapping in real BullMQ+Redis later is an adapter over
// this same {enqueue, cancelWaiting, onProcess, onFinalFailure} shape, not a
// rewrite of the tenancy/fencing logic that calls it.
//
// NOT durable across a process restart and NOT safe across multiple
// instances — a waiting job lives only in this process's memory. That's
// exactly what Redis-backed BullMQ is for; it isn't a hidden gap, it's the
// explicit scope of "in-process for now."

export function createInProcessDodQueue({
  delayMs = 30_000,
  attempts = 3,
  backoffMs = 5_000,
} = {}) {
  const waiting = new Map(); // taskId -> { timer, headSha, payload, attempt }
  let processor = null;
  let finalFailureHandler = null;

  function scheduleRun(taskId, afterMs) {
    const job = waiting.get(taskId);
    job.timer = setTimeout(() => runJob(taskId), afterMs);
  }

  async function runJob(taskId) {
    const job = waiting.get(taskId);
    if (!job) return;

    try {
      await processor({ taskId, headSha: job.headSha, payload: job.payload });
      waiting.delete(taskId);
    } catch (err) {
      job.attempt += 1;
      if (job.attempt >= attempts) {
        waiting.delete(taskId);
        await finalFailureHandler?.({
          taskId,
          headSha: job.headSha,
          payload: job.payload,
          error: err,
        });
        return;
      }
      scheduleRun(taskId, backoffMs);
    }
  }

  return {
    onProcess(fn) {
      processor = fn;
    },

    onFinalFailure(fn) {
      finalFailureHandler = fn;
    },

    // `headSha` in the (conceptual) jobId kills GitHub's duplicate delivery:
    // re-enqueuing the SAME sha for a taskId that's already waiting is a
    // no-op, not a timer reset. A DIFFERENT sha (rapid synchronize bursts)
    // sweeps the older waiting job and restarts the debounce window on the
    // newest one.
    enqueue({ taskId, headSha, payload }) {
      const existing = waiting.get(taskId);
      if (existing && existing.headSha === headSha) {
        return; // idempotent redelivery — don't restart the debounce clock
      }
      if (existing) {
        clearTimeout(existing.timer);
      }
      waiting.set(taskId, { timer: null, headSha, payload, attempt: 0 });
      scheduleRun(taskId, delayMs);
    },

    cancelWaiting(taskId) {
      const existing = waiting.get(taskId);
      if (!existing) return false;
      clearTimeout(existing.timer);
      waiting.delete(taskId);
      return true;
    },

    hasWaiting(taskId) {
      return waiting.has(taskId);
    },
  };
}
