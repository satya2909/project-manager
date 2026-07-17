import { describe, it, expect } from "vitest";
import { shouldEvaluate } from "../src/utils/webhook-trigger.js";

// plans/ai-dod-plan.md §3.2b / plans/PRD_v2.md §6.4 — PR events only, push is
// ignored entirely. Not a cost decision, an attention one: a dev pushes
// 8-15x/day and every WIP rejection is accurate and worthless.

describe("shouldEvaluate", () => {
  it("ignores push events entirely", () => {
    expect(shouldEvaluate("push", { ref: "refs/heads/main" })).toBe(false);
  });

  it("evaluates pull_request.opened when not a draft", () => {
    expect(
      shouldEvaluate("pull_request", { action: "opened", pull_request: { draft: false } }),
    ).toBe(true);
  });

  it("does not evaluate pull_request.opened when it's a draft", () => {
    expect(
      shouldEvaluate("pull_request", { action: "opened", pull_request: { draft: true } }),
    ).toBe(false);
  });

  it("evaluates pull_request.ready_for_review — the moment draft becomes ready", () => {
    expect(
      shouldEvaluate("pull_request", { action: "ready_for_review", pull_request: { draft: false } }),
    ).toBe(true);
  });

  it("evaluates pull_request.synchronize when not a draft", () => {
    expect(
      shouldEvaluate("pull_request", { action: "synchronize", pull_request: { draft: false } }),
    ).toBe(true);
  });

  it("does not evaluate pull_request.synchronize while still a draft", () => {
    expect(
      shouldEvaluate("pull_request", { action: "synchronize", pull_request: { draft: true } }),
    ).toBe(false);
  });

  it("evaluates pull_request.reopened", () => {
    expect(
      shouldEvaluate("pull_request", { action: "reopened", pull_request: { draft: false } }),
    ).toBe(true);
  });

  it("evaluates pull_request.edited ONLY when the title changed", () => {
    expect(
      shouldEvaluate("pull_request", {
        action: "edited",
        pull_request: { draft: false },
        changes: { title: { from: "old title" } },
      }),
    ).toBe(true);
  });

  it("does NOT evaluate pull_request.edited for a body-only edit — this is the exact bug found in /plan-ceo-review", () => {
    expect(
      shouldEvaluate("pull_request", {
        action: "edited",
        pull_request: { draft: false },
        changes: { body: { from: "old body" } },
      }),
    ).toBe(false);
  });

  it("does not evaluate other pull_request actions (e.g. labeled, assigned)", () => {
    expect(
      shouldEvaluate("pull_request", { action: "labeled", pull_request: { draft: false } }),
    ).toBe(false);
  });

  it("does not evaluate pull_request.closed even when merged (that's a separate freeze-verdict path, not a re-evaluation)", () => {
    expect(
      shouldEvaluate("pull_request", {
        action: "closed",
        pull_request: { draft: false, merged: true },
      }),
    ).toBe(false);
  });
});
