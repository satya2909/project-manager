import { describe, test, expect } from "vitest";
import {
  rejectPrecision,
  rejectRecall,
  citationVerificationRate,
  percentile,
  median,
  jaccardStability,
  failuresByBucket,
} from "../eval/metrics.js";

describe("rejectPrecision", () => {
  test("of the cases the pipeline rejected, the fraction that were actually should_reject", () => {
    const results = [
      { label: "should_reject", predicted: "REJECTED" },
      { label: "should_approve", predicted: "REJECTED" },
      { label: "should_approve", predicted: "APPROVED" },
      { label: "should_reject", predicted: "APPROVED" },
    ];

    expect(rejectPrecision(results)).toBe(0.5);
  });

  test("returns null when the pipeline never predicted REJECTED (undefined precision, not zero)", () => {
    const results = [
      { label: "should_approve", predicted: "APPROVED" },
      { label: "should_reject", predicted: "APPROVED" },
    ];

    expect(rejectPrecision(results)).toBeNull();
  });
});

describe("rejectRecall", () => {
  test("of the cases that were actually should_reject, the fraction the pipeline caught", () => {
    const results = [
      { label: "should_reject", predicted: "REJECTED" },
      { label: "should_reject", predicted: "APPROVED" },
      { label: "should_reject", predicted: "REJECTED" },
      { label: "should_approve", predicted: "REJECTED" },
    ];

    expect(rejectRecall(results)).toBeCloseTo(2 / 3);
  });

  test("returns null when the labeled set has no should_reject cases", () => {
    const results = [{ label: "should_approve", predicted: "APPROVED" }];

    expect(rejectRecall(results)).toBeNull();
  });
});

describe("citationVerificationRate", () => {
  test("fraction of citations across all findings that verified true", () => {
    const results = [
      { citations: [{ verified: true }, { verified: false }] },
      { citations: [{ verified: true }] },
    ];

    expect(citationVerificationRate(results)).toBeCloseTo(2 / 3);
  });

  test("returns null when there are no citations at all", () => {
    expect(citationVerificationRate([{ citations: [] }])).toBeNull();
  });
});

describe("percentile", () => {
  test("p95 of a sorted-by-the-function set of durations", () => {
    const durations = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(durations, 95)).toBe(95);
  });

  test("returns null for an empty array", () => {
    expect(percentile([], 95)).toBeNull();
  });
});

describe("median", () => {
  test("odd-length array returns the middle value", () => {
    expect(median([0.03, 0.01, 0.05])).toBe(0.03);
  });

  test("even-length array averages the two middle values", () => {
    expect(median([0.01, 0.02, 0.03, 0.04])).toBeCloseTo(0.025);
  });

  test("returns null for an empty array", () => {
    expect(median([])).toBeNull();
  });
});

describe("jaccardStability", () => {
  test("average pairwise Jaccard similarity across repeated requirement decompositions", () => {
    // 3 runs of decomposing the same task; run 3 drops one requirement the other two agreed on.
    const runs = [
      ["refresh token issued on login", "session invalidated on logout"],
      ["refresh token issued on login", "session invalidated on logout"],
      ["refresh token issued on login"],
    ];

    // pair(1,2): identical sets -> 1.0
    // pair(1,3) and pair(2,3): intersection 1 / union 2 -> 0.5 each
    // average of [1.0, 0.5, 0.5] = 2/3
    expect(jaccardStability(runs)).toBeCloseTo(2 / 3);
  });

  test("returns null with fewer than 2 runs (nothing to compare)", () => {
    expect(jaccardStability([["a requirement"]])).toBeNull();
  });

  test("identical single-requirement runs score a perfect 1", () => {
    expect(jaccardStability([["same"], ["same"], ["same"]])).toBe(1);
  });
});

describe("failuresByBucket", () => {
  test("counts mispredictions grouped by the case's labeled bucket", () => {
    const results = [
      { bucket: "existing-infra", label: "should_approve", predicted: "REJECTED" },
      { bucket: "existing-infra", label: "should_approve", predicted: "APPROVED" },
      { bucket: "injection", label: "should_reject", predicted: "APPROVED" },
      { bucket: "clean-approve", label: "should_approve", predicted: "APPROVED" },
    ];

    expect(failuresByBucket(results)).toEqual({
      "existing-infra": { failed: 1, total: 2 },
      injection: { failed: 1, total: 1 },
    });
  });

  test("returns an empty object when every case is predicted correctly", () => {
    const results = [
      { bucket: "clean-approve", label: "should_approve", predicted: "APPROVED" },
    ];
    expect(failuresByBucket(results)).toEqual({});
  });
});
