import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { critique } from "../src/dod/nodes/11-critique.js";
import { createRunState } from "../src/dod/state.js";

function state({ requirements, findings, verdict }) {
  const s = createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { headSha: "sha1" },
  });
  s.requirements = requirements;
  s.findings = findings;
  s.verdict = verdict;
  return s;
}

describe("critique (Node 11) — optional, cheap, never discards Node 10's tally", () => {
  it("writes a templated 'all evidenced' critique when nothing is unmet, without calling the LLM", async () => {
    const llmClient = vi.fn();
    const s = state({
      requirements: [{ id: "r1", text: "a" }],
      findings: [{ requirementId: "r1", status: "met", citations: [{ verified: true }] }],
      verdict: { evaluation: "APPROVED", requirementsTotal: 1, requirementsMet: 1 },
    });

    const result = await critique(s, { llmClient });

    expect(llmClient).not.toHaveBeenCalled();
    expect(result.verdict.critique).toContain("1 of 1");
  });

  it("calls the LLM to produce prose feedback when requirements are unmet", async () => {
    const llmClient = vi.fn(async () => ({ content: { critique: "Add rate limiting to the login route." }, tokensUsed: 30 }));
    const s = state({
      requirements: [{ id: "r1", text: "a" }, { id: "r2", text: "b" }],
      findings: [
        { requirementId: "r1", status: "met", citations: [{ verified: true }] },
        { requirementId: "r2", status: "unmet", citations: [], rationale: "no rate limit found" },
      ],
      verdict: { evaluation: "REJECTED", requirementsTotal: 2, requirementsMet: 1 },
    });

    const result = await critique(s, { llmClient });

    expect(result.verdict.critique).toBe("Add rate limiting to the login route.");
    expect(result.budget.tokensUsed).toBe(30);
  });

  it("falls back to a templated critique and keeps Node 10's verdict intact when the LLM call fails", async () => {
    const llmClient = vi.fn(async () => {
      throw new Error("timeout");
    });
    const s = state({
      requirements: [{ id: "r1", text: "a" }, { id: "r2", text: "b" }],
      findings: [
        { requirementId: "r1", status: "met", citations: [{ verified: true }] },
        { requirementId: "r2", status: "unmet", citations: [] },
      ],
      verdict: { evaluation: "REJECTED", requirementsTotal: 2, requirementsMet: 1 },
    });

    const result = await critique(s, { llmClient });

    expect(result.exit).toBeNull(); // must NOT fail the run
    expect(result.verdict.evaluation).toBe("REJECTED"); // Node 10's tally untouched
    expect(result.verdict.requirementsMet).toBe(1);
    expect(result.verdict.critique).toContain("1 of 2");
    expect(result.verdict.critique).toContain("unavailable");
  });
});
