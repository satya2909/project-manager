import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["backend/tests/**/*.test.js"],
    setupFiles: ["backend/tests/setup.js"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Each test file gets its own MongoMemoryServer instance (started in
    // setup.js) — running files sequentially keeps memory/port usage sane
    // for a repo with a handful of test files.
    fileParallelism: false,
  },
});
