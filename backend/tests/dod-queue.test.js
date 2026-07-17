import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInProcessDodQueue } from "../src/queue/dod-queue.js";

describe("createInProcessDodQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the processor after the debounce delay, not immediately", async () => {
    const queue = createInProcessDodQueue({ delayMs: 30_000 });
    const processor = vi.fn().mockResolvedValue();
    queue.onProcess(processor);

    queue.enqueue({ taskId: "t1", headSha: "sha1", payload: {} });
    expect(processor).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "t1", headSha: "sha1" }),
    );
  });

  it("three rapid enqueues with different SHAs produce exactly one run, reflecting the newest SHA", async () => {
    const queue = createInProcessDodQueue({ delayMs: 30_000 });
    const processor = vi.fn().mockResolvedValue();
    queue.onProcess(processor);

    queue.enqueue({ taskId: "t1", headSha: "sha1", payload: {} });
    vi.advanceTimersByTime(10_000);
    queue.enqueue({ taskId: "t1", headSha: "sha2", payload: {} });
    vi.advanceTimersByTime(10_000);
    queue.enqueue({ taskId: "t1", headSha: "sha3", payload: {} });

    await vi.advanceTimersByTimeAsync(30_000);

    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith(
      expect.objectContaining({ headSha: "sha3" }),
    );
  });

  it("re-enqueuing the SAME headSha (GitHub redelivery) does not reset the debounce timer", async () => {
    const queue = createInProcessDodQueue({ delayMs: 30_000 });
    const processor = vi.fn().mockResolvedValue();
    queue.onProcess(processor);

    queue.enqueue({ taskId: "t1", headSha: "sha1", payload: {} });
    vi.advanceTimersByTime(25_000);
    queue.enqueue({ taskId: "t1", headSha: "sha1", payload: {} }); // redelivery
    await vi.advanceTimersByTimeAsync(5_000); // if the timer HAD reset, this wouldn't be enough

    expect(processor).toHaveBeenCalledTimes(1);
  });

  it("cancelWaiting removes a pending job before it runs", async () => {
    const queue = createInProcessDodQueue({ delayMs: 30_000 });
    const processor = vi.fn().mockResolvedValue();
    queue.onProcess(processor);

    queue.enqueue({ taskId: "t1", headSha: "sha1", payload: {} });
    const cancelled = queue.cancelWaiting("t1");
    await vi.advanceTimersByTimeAsync(30_000);

    expect(cancelled).toBe(true);
    expect(processor).not.toHaveBeenCalled();
  });

  it("cancelWaiting returns false when there's nothing waiting for that task", () => {
    const queue = createInProcessDodQueue({ delayMs: 30_000 });
    expect(queue.cancelWaiting("nonexistent")).toBe(false);
  });

  it("retries on failure up to `attempts`, then calls onFinalFailure", async () => {
    const queue = createInProcessDodQueue({ delayMs: 1000, attempts: 3, backoffMs: 1000 });
    const processor = vi.fn().mockRejectedValue(new Error("boom"));
    const onFinalFailure = vi.fn();
    queue.onProcess(processor);
    queue.onFinalFailure(onFinalFailure);

    queue.enqueue({ taskId: "t1", headSha: "sha1", payload: {} });
    // 1 initial attempt + 2 retries = 3 total, with backoff between each
    await vi.advanceTimersByTimeAsync(1000); // initial run (attempt 1, fails)
    await vi.advanceTimersByTimeAsync(1000); // retry 1 (attempt 2, fails)
    await vi.advanceTimersByTimeAsync(2000); // retry 2 (attempt 3, fails) -> exhausted

    expect(processor).toHaveBeenCalledTimes(3);
    expect(onFinalFailure).toHaveBeenCalledTimes(1);
    expect(onFinalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "t1", headSha: "sha1" }),
    );
  });

  it("succeeds on retry — no final-failure call", async () => {
    const queue = createInProcessDodQueue({ delayMs: 1000, attempts: 3, backoffMs: 1000 });
    const processor = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce();
    const onFinalFailure = vi.fn();
    queue.onProcess(processor);
    queue.onFinalFailure(onFinalFailure);

    queue.enqueue({ taskId: "t1", headSha: "sha1", payload: {} });
    await vi.advanceTimersByTimeAsync(1000); // fails
    await vi.advanceTimersByTimeAsync(1000); // succeeds

    expect(processor).toHaveBeenCalledTimes(2);
    expect(onFinalFailure).not.toHaveBeenCalled();
  });
});
