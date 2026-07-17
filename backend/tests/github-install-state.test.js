import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createInstallState,
  consumeInstallState,
} from "../src/services/github-install-state.js";
import { createInMemoryTokenCache } from "../src/services/token-cache.js";

const SECRET = "test-hmac-secret";

describe("createInstallState / consumeInstallState", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips: a freshly created state consumes back to the same organizationId", async () => {
    const cache = createInMemoryTokenCache();
    const state = await createInstallState({
      organizationId: "org-123",
      secret: SECRET,
      cache,
    });

    const result = await consumeInstallState({ state, secret: SECRET, cache });
    expect(result.organizationId).toBe("org-123");
  });

  it("rejects a state that's been tampered with", async () => {
    const cache = createInMemoryTokenCache();
    const state = await createInstallState({
      organizationId: "org-123",
      secret: SECRET,
      cache,
    });
    const tampered = state.slice(0, -1) + (state.at(-1) === "a" ? "b" : "a");

    await expect(
      consumeInstallState({ state: tampered, secret: SECRET, cache }),
    ).rejects.toThrow(/invalid/i);
  });

  it("rejects a state signed with the wrong secret", async () => {
    const cache = createInMemoryTokenCache();
    const state = await createInstallState({
      organizationId: "org-123",
      secret: SECRET,
      cache,
    });

    await expect(
      consumeInstallState({ state, secret: "wrong-secret", cache }),
    ).rejects.toThrow(/invalid/i);
  });

  it("rejects a state after its TTL expires", async () => {
    vi.useFakeTimers();
    const cache = createInMemoryTokenCache();
    const state = await createInstallState({
      organizationId: "org-123",
      secret: SECRET,
      cache,
      ttlMs: 10 * 60_000,
    });

    vi.advanceTimersByTime(10 * 60_000 + 1);

    await expect(
      consumeInstallState({ state, secret: SECRET, cache }),
    ).rejects.toThrow(/expired/i);
  });

  it("rejects a REPLAYED state — single use, even though the HMAC is still valid", async () => {
    // This is the exact gap found in /plan-ceo-review: a stateless
    // HMAC-signed token is replayable within its TTL unless consumption is
    // tracked server-side. First consume succeeds, second must fail.
    const cache = createInMemoryTokenCache();
    const state = await createInstallState({
      organizationId: "org-123",
      secret: SECRET,
      cache,
    });

    await consumeInstallState({ state, secret: SECRET, cache });

    await expect(
      consumeInstallState({ state, secret: SECRET, cache }),
    ).rejects.toThrow(/already used|not found/i);
  });
});
