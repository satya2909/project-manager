import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { pinCommit } from "../src/dod/nodes/03-pin-commit.js";
import { createRunState } from "../src/dod/state.js";

function state(repo) {
  return createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo,
  });
}

describe("pinCommit (Node 3)", () => {
  it("pins headSha onto state.pinnedSha so every later node reads the same commit", async () => {
    const s = await pinCommit(state({ headSha: "abc123" }));
    expect(s.exit).toBeNull();
    expect(s.pinnedSha).toBe("abc123");
  });

  it("fails open with PASSED_BY_SYSTEM_ERROR when no headSha is available to pin", async () => {
    const s = await pinCommit(state({ headSha: null }));
    expect(s.exit).toEqual({ status: "PASSED_BY_SYSTEM_ERROR", errorCode: "NO_HEAD_SHA" });
  });
});
