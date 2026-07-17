import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { runPipeline } from "../src/dod/pipeline.js";
import { createRunState } from "../src/dod/state.js";

function state(overrides = {}) {
  return createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { headSha: "sha1" },
    ...overrides,
  });
}

describe("runPipeline", () => {
  it("runs every node in order when none of them exit", async () => {
    const calls = [];
    const nodeA = vi.fn(async (s) => { calls.push("A"); return s; });
    const nodeB = vi.fn(async (s) => { calls.push("B"); return s; });
    const persistNode = vi.fn(async (s) => { calls.push("persist"); return s; });

    await runPipeline([nodeA, nodeB], persistNode, state());

    expect(calls).toEqual(["A", "B", "persist"]);
  });

  it("stops running remaining nodes as soon as one sets state.exit, but always runs persist", async () => {
    const calls = [];
    const nodeA = vi.fn(async (s) => {
      calls.push("A");
      s.exit = { status: "SKIPPED", errorCode: "AI_DISABLED" };
      return s;
    });
    const nodeB = vi.fn(async (s) => { calls.push("B"); return s; });
    const persistNode = vi.fn(async (s) => { calls.push("persist"); return s; });

    const result = await runPipeline([nodeA, nodeB], persistNode, state());

    expect(calls).toEqual(["A", "persist"]);
    expect(nodeB).not.toHaveBeenCalled();
    expect(result.exit).toEqual({ status: "SKIPPED", errorCode: "AI_DISABLED" });
  });

  it("aborts with PASSED_BY_SYSTEM_ERROR/WALL_CLOCK_EXCEEDED when the run exceeds its wall clock cap", async () => {
    const calls = [];
    const slowNode = vi.fn(async (s) => {
      calls.push("slow");
      s.budget.startedAt = Date.now() - (s.budget.wallCapMs + 1000);
      return s;
    });
    const neverReached = vi.fn(async (s) => { calls.push("never"); return s; });
    const persistNode = vi.fn(async (s) => { calls.push("persist"); return s; });

    const result = await runPipeline([slowNode, neverReached], persistNode, state());

    expect(calls).toEqual(["slow", "persist"]);
    expect(neverReached).not.toHaveBeenCalled();
    expect(result.exit).toEqual({ status: "PASSED_BY_SYSTEM_ERROR", errorCode: "WALL_CLOCK_EXCEEDED" });
  });
});
