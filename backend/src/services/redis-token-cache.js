// backend/src/services/redis-token-cache.js
//
// Redis-backed implementation of the same {get, set, del} interface as
// token-cache.js's in-memory version (github-app.service.js and
// github-install-state.js are written against that interface, not against
// Redis directly — this is the swap TODOS.md called for, not a rewrite).
//
// Takes a client rather than constructing one, so tests can inject a fake
// client with zero real Redis dependency — see redis-token-cache.test.js.

export function createRedisTokenCache(client) {
  return {
    async get(key) {
      const value = await client.get(key);
      return value ?? null;
    },

    async set(key, value, ttlMs) {
      // PX, not EX — the interface's ttlMs is milliseconds throughout
      // (matches getInstallationToken's expiry-minus-safety-margin math).
      await client.set(key, value, "PX", ttlMs);
    },

    async del(key) {
      await client.del(key);
    },
  };
}
