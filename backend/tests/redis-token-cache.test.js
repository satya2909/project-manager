import { describe, it, expect, vi } from "vitest";
import { createRedisTokenCache } from "../src/services/redis-token-cache.js";

// A minimal fake ioredis client — just enough surface to prove
// createRedisTokenCache wires get/set/del to the right Redis commands with
// the right arguments. No real Redis needed for this.
function createFakeRedisClient() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, mode, ttlMs) {
      // ioredis: client.set(key, value, "PX", ttlMs)
      expect(mode).toBe("PX");
      store.set(key, value);
    },
    async del(key) {
      store.delete(key);
    },
    _store: store,
  };
}

describe("createRedisTokenCache", () => {
  it("returns null for a key that was never set", async () => {
    const cache = createRedisTokenCache(createFakeRedisClient());
    expect(await cache.get("missing")).toBeNull();
  });

  it("set() then get() round-trips the value", async () => {
    const client = createFakeRedisClient();
    const cache = createRedisTokenCache(client);
    await cache.set("gh:tok:123", "abc-token", 60_000);
    expect(await cache.get("gh:tok:123")).toBe("abc-token");
  });

  it("set() calls the client with PX (milliseconds) TTL, not EX (seconds)", async () => {
    const client = createFakeRedisClient();
    const setSpy = vi.spyOn(client, "set");
    const cache = createRedisTokenCache(client);
    await cache.set("gh:tok:123", "abc-token", 60_000);
    expect(setSpy).toHaveBeenCalledWith("gh:tok:123", "abc-token", "PX", 60_000);
  });

  it("del() removes a key", async () => {
    const client = createFakeRedisClient();
    const cache = createRedisTokenCache(client);
    await cache.set("gh:tok:123", "abc-token", 60_000);
    await cache.del("gh:tok:123");
    expect(await cache.get("gh:tok:123")).toBeNull();
  });

  it("propagates a real client error rather than swallowing it", async () => {
    const client = createFakeRedisClient();
    client.get = vi.fn().mockRejectedValue(new Error("connection refused"));
    const cache = createRedisTokenCache(client);
    await expect(cache.get("gh:tok:123")).rejects.toThrow("connection refused");
  });
});
