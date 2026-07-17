import { describe, test, expect } from "vitest";
import { runEval } from "../eval/run.js";

describe("runEval", () => {
  test("wires case+evaluate results into the metrics shape the report expects", () => {
    const cases = [
      { label: "should_approve", bucket: "clean-approve" },
      { label: "should_reject", bucket: "existing-infra" },
    ];

    const evaluate = (c) => ({
      label: c.label,
      bucket: c.bucket,
      predicted: c.label === "should_approve" ? "APPROVED" : "APPROVED", // stub always approves
      citations: [],
      durationMs: 1000,
      costUsd: 0.02,
    });

    const metrics = runEval(cases, evaluate);

    expect(metrics.caseCount).toBe(2);
    expect(metrics.rejectRecall).toBe(0); // the should_reject case was missed
    expect(metrics.rejectPrecision).toBeNull(); // stub never predicts REJECTED
    expect(metrics.failuresByBucket).toEqual({
      "existing-infra": { failed: 1, total: 1 },
    });
    expect(metrics.p95WallMs).toBe(1000);
    expect(metrics.medianCostUsd).toBe(0.02);
  });

  test("an empty case list reports zero cases without throwing", () => {
    const metrics = runEval([], () => ({}));
    expect(metrics.caseCount).toBe(0);
    expect(metrics.rejectPrecision).toBeNull();
    expect(metrics.p95WallMs).toBe(0);
    expect(metrics.medianCostUsd).toBe(0);
  });
});
