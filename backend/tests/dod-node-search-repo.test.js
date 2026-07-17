import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { searchRepo } from "../src/dod/nodes/06-search-repo.js";
import { createRunState } from "../src/dod/state.js";

function state() {
  const s = createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { fullName: "acme/camp", installationId: 999, headSha: "sha1" },
  });
  s.diff.files = [{ path: "src/routes/protected.js" }];
  s.requirements = [{ text: "Route uses verifyJWT middleware" }];
  return s;
}

describe("searchRepo (Node 6)", () => {
  it("unions diff paths, code search results, and the package.json heuristic", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const searchCodeImpl = vi.fn(async () => ["src/middlewares/auth.middlewares.js"]);

    const s = await searchRepo(state(), { getInstallationToken, searchCodeImpl });

    const paths = s.candidates.map((c) => c.path);
    expect(paths).toContain("src/routes/protected.js");
    expect(paths).toContain("src/middlewares/auth.middlewares.js");
    expect(paths).toContain("package.json");
    expect(s.searchDegraded).toBe(false);
  });

  it("dedupes a path that appears from more than one source", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const searchCodeImpl = vi.fn(async () => ["src/routes/protected.js"]);

    const s = await searchRepo(state(), { getInstallationToken, searchCodeImpl });

    const count = s.candidates.filter((c) => c.path === "src/routes/protected.js").length;
    expect(count).toBe(1);
  });

  it("caps candidates at 20", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const searchCodeImpl = vi.fn(async () => Array.from({ length: 30 }, (_, i) => `src/f${i}.js`));

    const s = await searchRepo(state(), { getInstallationToken, searchCodeImpl });

    expect(s.candidates.length).toBeLessThanOrEqual(20);
  });

  it("sets searchDegraded:true and continues with diff+heuristic candidates when code search fails (e.g. rate-limited)", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const searchCodeImpl = vi.fn(async () => {
      throw new Error("GitHub code search failed (403): rate limited");
    });

    const s = await searchRepo(state(), { getInstallationToken, searchCodeImpl });

    expect(s.exit).toBeNull();
    expect(s.searchDegraded).toBe(true);
    const paths = s.candidates.map((c) => c.path);
    expect(paths).toContain("src/routes/protected.js");
    expect(paths).toContain("package.json");
  });

  it("does not call code search when there are no requirement-derived terms", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const searchCodeImpl = vi.fn(async () => []);
    const s = state();
    s.requirements = [];

    await searchRepo(s, { getInstallationToken, searchCodeImpl });

    expect(searchCodeImpl).not.toHaveBeenCalled();
  });
});
