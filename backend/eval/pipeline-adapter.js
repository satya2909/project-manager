// backend/eval/pipeline-adapter.js
//
// Wires an eval-set case to the real DoD pipeline (Nodes 3, 5-11 —
// plans/PRD_v2.md §7.2), replacing the Phase 0 stub. Skips Nodes 1, 2, and
// 12 (resolveContext, checkBudget, persist) since those are DB-coupled —
// eval cases aren't real Task/Project/Organization documents, and there's
// nothing to persist. Node 4's job (decomposing requirements) is redone here
// with the same prompt/LLM call minus the Task/SubTask persistence, so the
// eval numbers reflect the same decomposition behavior production gets.
//
// Every LLM/GitHub call goes through the same fail-open contract the real
// nodes already have (plans/PRD_v2.md §7.3): missing
// ANTHROPIC_API_KEY/DOD_LLM_MODEL or GitHub App credentials doesn't crash
// the run, it reports PASSED_BY_SYSTEM_ERROR/SKIPPED for that case, exactly
// like it would in production — this file does not special-case "no
// credentials configured" because the nodes it calls already do.

import { runPipeline } from "../src/dod/pipeline.js";
import { createRunState } from "../src/dod/state.js";
import { pinCommit } from "../src/dod/nodes/03-pin-commit.js";
import { fetchDiff } from "../src/dod/nodes/05-fetch-diff.js";
import { searchRepo } from "../src/dod/nodes/06-search-repo.js";
import { readFiles } from "../src/dod/nodes/07-read-files.js";
import { extractEvidence } from "../src/dod/nodes/08-extract-evidence.js";
import { verifyCitations } from "../src/dod/nodes/09-verify-citations.js";
import { tally } from "../src/dod/nodes/10-tally.js";
import { critique } from "../src/dod/nodes/11-critique.js";
import { callLlm as defaultLlmClient } from "../src/dod/llm/client.js";
import { buildDecomposePrompt } from "../src/dod/prompts/decompose.v1.js";
import { PROMPT_VERSION } from "../src/dod/prompts/_version.js";

// No separate input/output token accounting exists yet (state.budget.tokensUsed
// is combined) — this is a rough blended-rate estimate (~Sonnet-tier pricing),
// not the real billing number the fenced-write path would compute.
const APPROX_USD_PER_TOKEN = 3 / 1_000_000;

const noopPersist = async (state) => state;

// Node 4's decomposition step, without Task/SubTask persistence — eval
// cases have no backing Task document to read cached requirements from or
// write freshly-decomposed ones to, so this always decomposes fresh.
async function decomposeRequirementsForEval(state, { llmClient = defaultLlmClient } = {}) {
  const { system, messages } = buildDecomposePrompt({
    title: state.task.title,
    description: state.task.description,
    subtaskTitles: [],
  });

  let result;
  try {
    result = await llmClient({ system, messages, temperature: 0 });
  } catch (err) {
    state.errors.push({ node: "requirements", message: err.message });
    state.exit = { status: "PASSED_BY_SYSTEM_ERROR", errorCode: "LLM_TIMEOUT" };
    return state;
  }

  const texts = Array.isArray(result.content?.requirements) ? result.content.requirements : [];
  if (texts.length === 0) {
    state.exit = { status: "SKIPPED", errorCode: "NO_ACTIVE_REQUIREMENTS" };
    return state;
  }

  state.requirements = texts
    .slice(0, 8)
    .map((text, i) => ({ id: `eval-req-${i}`, text, source: "ai" }));
  state.budget.tokensUsed += result.tokensUsed ?? 0;
  state.budget.llmCalls += 1;
  state.promptVersion = PROMPT_VERSION;
  return state;
}

export async function evaluateWithRealPipeline(evalCase, overrides = {}) {
  const state = createRunState({
    runId: `eval:${evalCase.id}`,
    trigger: "manual",
    organizationId: null,
    projectId: null,
    taskId: null,
    evaluationSeq: 0,
    repo: {
      fullName: process.env.EVAL_GITHUB_FULL_NAME || "satya2909/project-manager",
      installationId: process.env.EVAL_GITHUB_INSTALLATION_ID || null,
      headSha: evalCase.headSha,
      baseSha: evalCase.baseSha,
      prNumber: evalCase.prNumber ?? null,
    },
  });

  state.task = { title: evalCase.task.title, description: evalCase.task.description };

  const nodes = [
    pinCommit,
    (s) => decomposeRequirementsForEval(s, overrides),
    (s) => fetchDiff(s, overrides),
    (s) => searchRepo(s, overrides),
    (s) => readFiles(s, overrides),
    (s) => extractEvidence(s, overrides),
    verifyCitations,
    tally,
    (s) => critique(s, overrides),
  ];

  const finalState = await runPipeline(nodes, noopPersist, state);

  const citations = finalState.findings.flatMap((f) =>
    (f.citations ?? []).map((c) => ({ verified: Boolean(c.verified) })),
  );

  return {
    id: evalCase.id,
    label: evalCase.label,
    bucket: evalCase.bucket,
    predicted: finalState.exit ? finalState.exit.status : (finalState.verdict?.evaluation ?? "ERROR"),
    errorCode: finalState.exit?.errorCode ?? null,
    citations,
    durationMs: Date.now() - finalState.budget.startedAt,
    costUsd: finalState.budget.tokensUsed * APPROX_USD_PER_TOKEN,
  };
}
