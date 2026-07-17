import { describe, test, expect } from "vitest";
import { formatReport } from "../eval/report.js";

describe("formatReport", () => {
  test("stub run: zero real metrics, all gates fail, buckets show every stub-approved case as a failure", () => {
    const report = formatReport({
      promptVersion: "v0-stub",
      model: "none",
      caseCount: 50,
      rejectPrecision: null,
      rejectRecall: null,
      citationVerificationRate: null,
      decompStability: null,
      p95WallMs: 0,
      medianCostUsd: 0,
      failuresByBucket: {
        "existing-infra": { failed: 8, total: 8 },
        drift: { failed: 5, total: 5 },
        injection: { failed: 2, total: 2 },
      },
    });

    expect(report).toContain("DoD Eval — promptVersion: v0-stub | model: none | 50 cases");
    expect(report).toContain("REJECT precision       n/a   (target ≥ 0.90)");
    expect(report).toContain("REJECT recall          n/a   (target ≥ 0.60)");
    expect(report).toContain("Citation verify rate   n/a   (target ≥ 0.95)");
    expect(report).toContain("Decomp stability       n/a   (target ≥ 0.90)");
    expect(report).toContain("p95 wall clock        0.0s   (target < 90s)");
    expect(report).toContain("Median cost         $0.000   (target < $0.05)");
    expect(report).toContain("Failures by bucket:  existing-infra 8/8 · drift 5/5 · injection 2/2");
  });

  test("a real run with numbers renders pass/fail marks against each gate's target", () => {
    const report = formatReport({
      promptVersion: "v1",
      model: "claude-sonnet-5",
      caseCount: 50,
      rejectPrecision: 0.92,
      rejectRecall: 0.7,
      citationVerificationRate: 0.97,
      decompStability: 0.91,
      p95WallMs: 45000,
      medianCostUsd: 0.03,
      failuresByBucket: {},
    });

    expect(report).toContain("REJECT precision      0.92   (target ≥ 0.90)  ✓");
    expect(report).toContain("REJECT recall         0.70   (target ≥ 0.60)  ✓");
    expect(report).toContain("p95 wall clock       45.0s   (target < 90s)  ✓");
    expect(report).toContain("Median cost         $0.030   (target < $0.05)  ✓");
    expect(report).not.toContain("Failures by bucket");
  });

  test("a failing precision gate is marked with a cross, not a check", () => {
    const report = formatReport({
      promptVersion: "v1",
      model: "claude-sonnet-5",
      caseCount: 50,
      rejectPrecision: 0.72,
      rejectRecall: 0.5,
      citationVerificationRate: 0.9,
      decompStability: 0.85,
      p95WallMs: 95000,
      medianCostUsd: 0.06,
      failuresByBucket: { "existing-infra": { failed: 3, total: 8 } },
    });

    expect(report).toContain("REJECT precision      0.72   (target ≥ 0.90)  ✗");
    expect(report).toContain("Failures by bucket:  existing-infra 3/8");
  });
});
