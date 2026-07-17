import { describe, it, expect, vi, afterEach } from "vitest";
import { createInMemoryTokenCache } from "../src/services/token-cache.js";

describe("createInMemoryTokenCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for a key that was never set", async () => {
    const cache = createInMemoryTokenCache();
    expect(await cache.get("missing")).toBeNull();
  });

  it("returns the value while the TTL hasn't expired", async () => {
    const cache = createInMemoryTokenCache();
    await cache.set("gh:tok:123", "abc-token", 60_000);
    expect(await cache.get("gh:tok:123")).toBe("abc-token");
  });

  it("returns null once the TTL has expired", async () => {
    vi.useFakeTimers();
    const cache = createInMemoryTokenCache();
    await cache.set("gh:tok:123", "abc-token", 1000);
    vi.advanceTimersByTime(1001);
    expect(await cache.get("gh:tok:123")).toBeNull();
  });

  it("del() removes a key immediately", async () => {
    const cache = createInMemoryTokenCache();
    await cache.set("gh:tok:123", "abc-token", 60_000);
    await cache.del("gh:tok:123");
    expect(await cache.get("gh:tok:123")).toBeNull();
  });
});
