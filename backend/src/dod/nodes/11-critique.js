// Node 11 — critique (LLM, optional, cheap). Turns unmet findings into
// prose for the developer. Its failure must NEVER discard a correct,
// mechanically-verified tally from Node 10 — wrap the LLM call in try/catch;
// on failure, fall back to a templated string and continue to Node 12 with
// Node 10's verdict intact (plans/ai-dod-plan.md §4.1 4f).

import { callLlm } from "../llm/client.js";
import { buildCritiquePrompt } from "../prompts/critique.v1.js";

function templatedSummary(verdict) {
  return `${verdict.requirementsMet} of ${verdict.requirementsTotal} requirements evidenced.`;
}

export async function critique(state, { llmClient = callLlm } = {}) {
  const unmet = state.findings.filter((f) => f.status !== "met");

  if (unmet.length === 0) {
    state.verdict.critique = templatedSummary(state.verdict);
    return state;
  }

  try {
    const { system, messages } = buildCritiquePrompt({
      requirements: state.requirements,
      findings: state.findings,
    });
    const result = await llmClient({ system, messages, temperature: 0 });

    state.verdict.critique = result.content?.critique ?? templatedSummary(state.verdict);
    state.budget.tokensUsed += result.tokensUsed ?? 0;
    state.budget.llmCalls += 1;
  } catch (err) {
    state.errors.push({ node: "critique", message: err.message });
    state.verdict.critique = `${templatedSummary(state.verdict)} Detailed feedback unavailable.`;
  }

  return state;
}
