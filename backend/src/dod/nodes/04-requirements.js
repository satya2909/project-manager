// Node 4 — loadOrDecomposeRequirements (LLM, cached, at most once per task).
// Reuses persisted Task.requirements if any are active; otherwise decomposes
// once and persists the result. Requirements are never silently regenerated
// — the single highest-leverage decision in the design (plans/PRD_v2.md
// §7.2 Node 4): if they regenerated every run, the same unchanged code
// could yield a different requirement count on every push.

import { Task, SubTask } from "../../models/index.js";
import { callLlm } from "../llm/client.js";
import { buildDecomposePrompt } from "../prompts/decompose.v1.js";
import { PROMPT_VERSION } from "../prompts/_version.js";

const MAX_REQUIREMENTS = 8;

export async function loadOrDecomposeRequirements(state, { llmClient = callLlm } = {}) {
  const activeExisting = (state.task.requirements ?? []).filter((r) => r.active);
  if (activeExisting.length > 0) {
    state.requirements = activeExisting.map((r) => ({
      id: r._id,
      text: r.text,
      source: r.source,
    }));
    return state;
  }

  const subtasks = await SubTask.find({ task: state.task._id }).select("title").lean();
  const { system, messages } = buildDecomposePrompt({
    title: state.task.title,
    description: state.task.description,
    subtaskTitles: subtasks.map((s) => s.title),
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

  const newRequirements = texts.slice(0, MAX_REQUIREMENTS).map((text) => ({
    text,
    source: "ai",
    active: true,
  }));

  const updated = await Task.findByIdAndUpdate(
    state.task._id,
    {
      $push: { requirements: { $each: newRequirements } },
      $inc: { requirementsVersion: 1 },
    },
    { new: true },
  );

  state.task = updated;
  state.requirements = updated.requirements
    .filter((r) => r.active)
    .map((r) => ({ id: r._id, text: r.text, source: r.source }));
  state.budget.tokensUsed += result.tokensUsed ?? 0;
  state.budget.llmCalls += 1;
  state.promptVersion = PROMPT_VERSION;

  return state;
}
