// backend/eval/run.js
//
// Phase 0.2 (plans/ai-dod-plan.md) — runs the labeled eval set through the
// DoD pipeline (a stub until Phase 4 lands) and reports the target metrics.
//
// Usage: npm run eval:dod

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  rejectPrecision,
  rejectRecall,
  citationVerificationRate,
  jaccardStability,
  percentile,
  median,
  failuresByBucket,
} from "./metrics.js";
import { formatReport } from "./report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOD_SET_PATH = path.join(__dirname, "dod-set.json");
const PROMPT_VERSION = "v0-stub";
const MODEL = "none";

// Stub pipeline (Phase 3.5 / Phase 4 not built yet): always APPROVED, no
// citations, no cost, no latency. Exists so the harness's contract (load set
// → run → report against targets) is provable before there's a real model
// behind it. Real numbers replace this wiring in Phase 4, not this file's
// structure.
function stubEvaluate(evalCase) {
  return {
    label: evalCase.label,
    bucket: evalCase.bucket,
    predicted: "APPROVED",
    citations: [],
    durationMs: 0,
    costUsd: 0,
  };
}

export function loadDodSet(filePath = DOD_SET_PATH) {
  const raw = readFileSync(filePath, "utf-8");
  const cases = JSON.parse(raw);
  return cases.filter((c) => c.label !== null);
}

export function runEval(cases, evaluate = stubEvaluate) {
  const results = cases.map(evaluate);
  return {
    promptVersion: PROMPT_VERSION,
    model: MODEL,
    caseCount: results.length,
    rejectPrecision: rejectPrecision(results),
    rejectRecall: rejectRecall(results),
    citationVerificationRate: citationVerificationRate(results),
    decompStability: null, // requires 3 repeated runs of node 4 — wired in Phase 4b
    p95WallMs: percentile(results.map((r) => r.durationMs), 95) ?? 0,
    medianCostUsd: median(results.map((r) => r.costUsd)) ?? 0,
    failuresByBucket: failuresByBucket(results),
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const cases = loadDodSet();
  if (cases.length === 0) {
    console.error(
      "⚠ backend/eval/dod-set.json has no labeled cases yet (label: null on all entries).\n" +
        "  Run `node backend/src/scripts/harvest-eval-set.js` to get candidates, then\n" +
        "  hand-label 50 of them per plans/ai-dod-plan.md §0.1's bucket targets.\n" +
        "  Reporting against 0 cases below — this is expected until labeling is done.",
    );
  }
  const metrics = runEval(cases);
  console.log(formatReport(metrics));
}
