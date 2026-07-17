import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { tally } from "../src/dod/nodes/10-tally.js";
import { createRunState } from "../src/dod/state.js";

function state({ requirements, findings }) {
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
  return s;
}

describe("tally (Node 10) — deterministic, the model never reports a score", () => {
  it("APPROVED when every requirement is met with a verified citation", async () => {
    const s = state({
      requirements: [{ id: "r1", text: "a" }, { id: "r2", text: "b" }],
      findings: [
        { requirementId: "r1", status: "met", citations: [{ verified: true }] },
        { requirementId: "r2", status: "met", citations: [{ verified: true }] },
      ],
    });

    const result = await tally(s);
    expect(result.verdict.evaluation).toBe("APPROVED");
    expect(result.verdict.requirementsTotal).toBe(2);
    expect(result.verdict.requirementsMet).toBe(2);
  });

  it("REJECTED when at least one requirement is unmet", async () => {
    const s = state({
      requirements: [{ id: "r1", text: "a" }, { id: "r2", text: "b" }],
      findings: [
        { requirementId: "r1", status: "met", citations: [{ verified: true }] },
        { requirementId: "r2", status: "unmet", citations: [] },
      ],
    });

    const result = await tally(s);
    expect(result.verdict.evaluation).toBe("REJECTED");
    expect(result.verdict.requirementsMet).toBe(1);
    expect(result.verdict.requirementsTotal).toBe(2);
  });

  it("does not count a 'met' finding whose citations all failed verification", async () => {
    const s = state({
      requirements: [{ id: "r1", text: "a" }],
      findings: [{ requirementId: "r1", status: "unverified", citations: [{ verified: false }] }],
    });

    const result = await tally(s);
    expect(result.verdict.requirementsMet).toBe(0);
    expect(result.verdict.evaluation).toBe("REJECTED");
  });

  it("vacuous-approval guard: total===0 (all requirements deactivated) exits SKIPPED, never auto-APPROVED", async () => {
    const s = state({ requirements: [], findings: [] });

    const result = await tally(s);
    expect(result.exit).toEqual({ status: "SKIPPED", errorCode: "NO_ACTIVE_REQUIREMENTS" });
    expect(result.verdict).toBeNull();
  });
});
