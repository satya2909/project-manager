// backend/eval/run.js
//
// Phase 0.2 / Phase 4 (plans/ai-dod-plan.md) — runs the labeled eval set
// through the real DoD pipeline (backend/eval/pipeline-adapter.js) and
// reports the target metrics. Every case still runs even without
// ANTHROPIC_API_KEY/DOD_LLM_MODEL or GitHub App credentials configured —
// each node's own fail-open contract reports PASSED_BY_SYSTEM_ERROR for
// that case instead of crashing the run, exactly like it would in
// production (plans/PRD_v2.md §7.3).
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
import { evaluateWithRealPipeline } from "./pipeline-adapter.js";
import { PROMPT_VERSION } from "../src/dod/prompts/_version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOD_SET_PATH = path.join(__dirname, "dod-set.json");
const MODEL = process.env.DOD_LLM_MODEL || "claude-sonnet-4-6";

export function loadDodSet(filePath = DOD_SET_PATH) {
  const raw = readFileSync(filePath, "utf-8");
  const cases = JSON.parse(raw);
  return cases.filter((c) => c.label !== null);
}

export async function runEval(cases, evaluate = evaluateWithRealPipeline) {
  const results = await Promise.all(cases.map(evaluate));
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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "⚠ ANTHROPIC_API_KEY is not set — every case's requirements-decomposition call\n" +
        "  (Node 4) will fail and report PASSED_BY_SYSTEM_ERROR. Numbers below are not\n" +
        "  real accuracy numbers until it's configured (see docs/github-app-setup.md).",
    );
  }
  const metrics = await runEval(cases);
  console.log(formatReport(metrics));
}
