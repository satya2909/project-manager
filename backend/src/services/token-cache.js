// backend/src/services/token-cache.js
//
// Pluggable cache interface for GitHub App installation tokens (Phase 2.3,
// plans/ai-dod-plan.md). In-memory today — the Redis/worker hosting decision
// is still open (see TODOS.md). Swapping in a Redis-backed implementation
// later means writing one file with this same {get, set, del} shape, not
// rewriting github-app.service.js.
//
// NOT safe across multiple processes/instances — an in-memory cache is
// per-process, so a multi-instance deploy would mint redundant tokens (extra
// GitHub API calls, not a correctness bug, since each instance's cache is
// simply cold on its own). That's the exact limitation Redis is meant to fix.

export function createInMemoryTokenCache() {
  const store = new Map();

  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() >= entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },

    async set(key, value, ttlMs) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    async del(key) {
      store.delete(key);
    },
  };
}
