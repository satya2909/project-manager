// Node 1 — resolveContext (deterministic, no LLM). Executes the §4.1 chain
// fresh at run time (the webhook resolved it once for routing; the worker
// may run this much later, so state can have changed). Fails closed at
// every link and early-exits on a kill switch or mode:'off'
// (plans/PRD_v2.md §7.2).

import { Task, Project, OrgAiSettings } from "../../models/index.js";

export async function resolveContext(state) {
  const task = await Task.findById(state.taskId);
  if (!task) {
    state.exit = { status: "SKIPPED", errorCode: "TASK_NOT_FOUND" };
    return state;
  }

  const project = await Project.findById(state.projectId);
  if (!project) {
    state.exit = { status: "SKIPPED", errorCode: "PROJECT_NOT_FOUND" };
    return state;
  }

  const orgAiSettings = await OrgAiSettings.findOne({ organization: state.organizationId });
  if (orgAiSettings?.killSwitch || orgAiSettings?.mode === "off") {
    state.exit = { status: "SKIPPED", errorCode: "AI_DISABLED" };
    return state;
  }

  state.task = task;
  state.project = project;
  state.orgAiSettings = orgAiSettings;
  return state;
}
