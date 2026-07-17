// Node 8 — extractEvidence (LLM, the load-bearing node). Semantic mapping
// from "this code exists" to "this requirement is satisfied" — keyword
// matching can't tell working code from commented-out/dead code/test
// fixtures/README mentions, which is exactly what an LLM is for
// (plans/PRD_v2.md §7.2 Node 8).
//
// "met" without at least one citation is invalid (the prompt says so, and
// this node re-enforces it in code rather than trusting the model to
// comply) — Node 9 then mechanically verifies each citation actually exists.

import { callLlm } from "../llm/client.js";
import { buildExtractEvidencePrompt } from "../prompts/extract-evidence.v1.js";
import { PROMPT_VERSION } from "../prompts/_version.js";
import { detectInjectionPatterns } from "../github/injection-patterns.js";

export async function extractEvidence(state, { llmClient = callLlm } = {}) {
  // Prompt injection defense #3 (§7.5) — doesn't block, just flags for
  // project admins. Checked once here since this is the node that hands
  // the diff to a model at all.
  state.injectionPatternDetected = detectInjectionPatterns(state.diff.text);

  const { system, messages } = buildExtractEvidencePrompt({
    requirements: state.requirements,
    diffText: state.diff.text,
    files: state.files,
  });

  let result;
  try {
    result = await llmClient({ system, messages, temperature: 0 });
  } catch (err) {
    state.errors.push({ node: "extractEvidence", message: err.message });
    state.exit = { status: "PASSED_BY_SYSTEM_ERROR", errorCode: "LLM_TIMEOUT" };
    return state;
  }

  const rawFindings = Array.isArray(result.content?.findings) ? result.content.findings : [];

  state.findings = rawFindings.map((finding) => {
    const citations = finding.citations ?? [];
    if (finding.status === "met" && citations.length === 0) {
      return { ...finding, status: "unmet", citations: [] };
    }
    return { ...finding, citations };
  });

  state.budget.tokensUsed += result.tokensUsed ?? 0;
  state.budget.llmCalls += 1;
  state.promptVersion = PROMPT_VERSION;

  return state;
}
