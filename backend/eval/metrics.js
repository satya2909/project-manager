export function rejectPrecision(results) {
  const predictedRejected = results.filter((r) => r.predicted === "REJECTED");
  if (predictedRejected.length === 0) return null;
  const correct = predictedRejected.filter((r) => r.label === "should_reject");
  return correct.length / predictedRejected.length;
}

export function rejectRecall(results) {
  const actualRejects = results.filter((r) => r.label === "should_reject");
  if (actualRejects.length === 0) return null;
  const caught = actualRejects.filter((r) => r.predicted === "REJECTED");
  return caught.length / actualRejects.length;
}

export function citationVerificationRate(results) {
  const citations = results.flatMap((r) => r.citations ?? []);
  if (citations.length === 0) return null;
  const verified = citations.filter((c) => c.verified);
  return verified.length / citations.length;
}

export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function jaccard(setA, setB) {
  const a = new Set(setA);
  const b = new Set(setB);
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : intersection / union;
}

export function jaccardStability(runs) {
  if (runs.length < 2) return null;
  const scores = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      scores.push(jaccard(runs[i], runs[j]));
    }
  }
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

export function failuresByBucket(results) {
  const buckets = {};
  for (const r of results) {
    const correct =
      (r.label === "should_approve" && r.predicted === "APPROVED") ||
      (r.label === "should_reject" && r.predicted === "REJECTED");
    if (!buckets[r.bucket]) buckets[r.bucket] = { failed: 0, total: 0 };
    buckets[r.bucket].total += 1;
    if (!correct) buckets[r.bucket].failed += 1;
  }
  for (const key of Object.keys(buckets)) {
    if (buckets[key].failed === 0) delete buckets[key];
  }
  return buckets;
}
