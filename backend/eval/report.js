function fmtPct(value, digits = 2) {
  return value === null ? "n/a" : value.toFixed(digits);
}

function gateMark(value, target, comparator) {
  if (value === null) return "";
  const passed = comparator(value, target);
  return passed ? "  ✓" : "  ✗";
}

export function formatReport(metrics) {
  const {
    promptVersion,
    model,
    caseCount,
    rejectPrecision,
    rejectRecall,
    citationVerificationRate,
    decompStability,
    p95WallMs,
    medianCostUsd,
    failuresByBucket,
  } = metrics;

  const lines = [];
  lines.push(
    `DoD Eval — promptVersion: ${promptVersion} | model: ${model} | ${caseCount} cases`,
  );
  lines.push("");
  lines.push(
    `  REJECT precision      ${fmtPct(rejectPrecision).padStart(4)}   (target ≥ 0.90)${gateMark(rejectPrecision, 0.9, (v, t) => v >= t)}`,
  );
  lines.push(
    `  REJECT recall         ${fmtPct(rejectRecall).padStart(4)}   (target ≥ 0.60)${gateMark(rejectRecall, 0.6, (v, t) => v >= t)}`,
  );
  lines.push(
    `  Citation verify rate  ${fmtPct(citationVerificationRate).padStart(4)}   (target ≥ 0.95)${gateMark(citationVerificationRate, 0.95, (v, t) => v >= t)}`,
  );
  lines.push(
    `  Decomp stability      ${fmtPct(decompStability).padStart(4)}   (target ≥ 0.90)${gateMark(decompStability, 0.9, (v, t) => v >= t)}`,
  );
  const p95Str = `${(p95WallMs / 1000).toFixed(1)}s`;
  lines.push(
    `  p95 wall clock       ${p95Str.padStart(5)}   (target < 90s)${gateMark(p95WallMs, 90000, (v, t) => v < t)}`,
  );
  const costStr = `$${medianCostUsd.toFixed(3)}`;
  lines.push(
    `  Median cost         ${costStr.padStart(6)}   (target < $0.05)${gateMark(medianCostUsd, 0.05, (v, t) => v < t)}`,
  );

  const bucketEntries = Object.entries(failuresByBucket ?? {});
  if (bucketEntries.length > 0) {
    lines.push("");
    const bucketStr = bucketEntries
      .map(([name, { failed, total }]) => `${name} ${failed}/${total}`)
      .join(" · ");
    lines.push(`  Failures by bucket:  ${bucketStr}`);
  }

  return lines.join("\n");
}
