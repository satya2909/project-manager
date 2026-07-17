import { describe, it, expect, vi } from "vitest";
import { getRepoAndToken } from "../src/dod/github/installation-auth.js";
import { createRunState } from "../src/dod/state.js";

function state() {
  return createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: "org1",
    projectId: "proj1",
    taskId: "task1",
    evaluationSeq: 1,
    repo: { fullName: "acme/camp", installationId: 999, headSha: "sha1" },
  });
}

describe("getRepoAndToken", () => {
  it("splits owner/repo from state.repo.fullName and mints an installation token", async () => {
    const getInstallationToken = vi.fn(async () => "tok");

    const result = await getRepoAndToken(state(), { getInstallationToken });

    expect(result).toEqual({ owner: "acme", repo: "camp", token: "tok" });
    expect(getInstallationToken).toHaveBeenCalledWith(expect.objectContaining({ installationId: 999 }));
  });

  it("propagates a thrown error from token minting", async () => {
    const getInstallationToken = vi.fn(async () => {
      throw new Error("mint failed");
    });

    await expect(getRepoAndToken(state(), { getInstallationToken })).rejects.toThrow("mint failed");
  });
});
