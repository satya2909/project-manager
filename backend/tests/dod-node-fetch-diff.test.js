import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { fetchDiff } from "../src/dod/nodes/05-fetch-diff.js";
import { createRunState } from "../src/dod/state.js";

function state() {
  return createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { fullName: "acme/camp", installationId: 999, headSha: "sha1", prNumber: 42 },
  });
}

describe("fetchDiff (Node 5)", () => {
  it("fetches the PR diff, strips it, and stores the result on state.diff", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const fetchDiffImpl = vi.fn(async () => "diff --git a/src/index.js b/src/index.js\n+added\n");

    const s = await fetchDiff(state(), { getInstallationToken, fetchDiffImpl });

    expect(s.exit).toBeNull();
    expect(getInstallationToken).toHaveBeenCalledWith(expect.objectContaining({ installationId: 999 }));
    expect(fetchDiffImpl).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", repo: "camp", prNumber: 42, token: "tok" }),
    );
    expect(s.diff.files).toEqual([{ path: "src/index.js" }]);
  });

  it("retries on GitHub failure up to 3 times, then fails open with PASSED_BY_SYSTEM_ERROR", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const fetchDiffImpl = vi.fn(async () => {
      throw new Error("GitHub PR diff fetch failed (500): server error");
    });

    const s = await fetchDiff(state(), { getInstallationToken, fetchDiffImpl, delayImpl: async () => {} });

    expect(fetchDiffImpl).toHaveBeenCalledTimes(3);
    expect(s.exit).toEqual({ status: "PASSED_BY_SYSTEM_ERROR", errorCode: "GITHUB_UNAVAILABLE" });
  });
});
