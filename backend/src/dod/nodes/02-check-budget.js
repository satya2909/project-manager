// Node 2 — checkBudget (deterministic). Reads OrgAiUsage for the current
// period; over quota fails open — the run is not blocked, the task's board
// is never frozen because an org ran out of tokens (plans/PRD_v2.md §7.2).

import { OrgAiUsage } from "../../models/index.js";

const DEFAULT_MONTHLY_QUOTA = 2_000_000;

function currentPeriod() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export async function checkBudget(state) {
  const quota = state.orgAiSettings?.monthlyTokenQuota ?? DEFAULT_MONTHLY_QUOTA;
  const usage = await OrgAiUsage.findOne({
    organization: state.organizationId,
    period: currentPeriod(),
  });

  if (usage && usage.tokensUsed >= quota) {
    state.exit = { status: "PASSED_BY_SYSTEM_ERROR", errorCode: "QUOTA_EXCEEDED" };
    return state;
  }

  return state;
}
