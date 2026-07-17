import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { checkBudget } from "../src/dod/nodes/02-check-budget.js";
import { createRunState } from "../src/dod/state.js";
import { OrgAiUsage } from "../src/models/index.js";

function state(overrides = {}) {
  const organizationId = new mongoose.Types.ObjectId();
  return createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId,
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { headSha: "sha1" },
    ...overrides,
  });
}

describe("checkBudget (Node 2)", () => {
  it("passes through when no usage document exists yet for this period", async () => {
    const s = await checkBudget(state());
    expect(s.exit).toBeNull();
  });

  it("passes through when usage is under the org's quota", async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const period = new Date().toISOString().slice(0, 7);
    await OrgAiUsage.create({ organization: organizationId, period, tokensUsed: 1000, runs: 5 });

    const s = await checkBudget(state({ organizationId }));
    expect(s.exit).toBeNull();
  });

  it("fails open with PASSED_BY_SYSTEM_ERROR/QUOTA_EXCEEDED when usage meets or exceeds the org's quota", async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const period = new Date().toISOString().slice(0, 7);
    // Default quota comes from OrgAiSettings.monthlyTokenQuota (default
    // 2,000,000) when no settings doc exists — see state.orgAiSettings.
    await OrgAiUsage.create({ organization: organizationId, period, tokensUsed: 2_000_000, runs: 500 });

    const s = await checkBudget(state({ organizationId }));
    expect(s.exit).toEqual({ status: "PASSED_BY_SYSTEM_ERROR", errorCode: "QUOTA_EXCEEDED" });
  });

  it("honors a custom monthlyTokenQuota from state.orgAiSettings", async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const period = new Date().toISOString().slice(0, 7);
    await OrgAiUsage.create({ organization: organizationId, period, tokensUsed: 500, runs: 1 });

    const s = state({ organizationId });
    s.orgAiSettings = { monthlyTokenQuota: 400 };
    const result = await checkBudget(s);
    expect(result.exit).toEqual({ status: "PASSED_BY_SYSTEM_ERROR", errorCode: "QUOTA_EXCEEDED" });
  });
});
