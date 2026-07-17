import mongoose, { Schema } from "mongoose";

// Monthly token usage per org (plans/PRD_v2.md §5.10). Checked at Node 2
// (checkBudget) against OrgAiSettings.monthlyTokenQuota; bumped at Node 12
// (persist) from the run's tokensUsed. One document per org per period —
// "period" resets the counter cleanly without a cron job or TTL race.
const orgAiUsageSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    period: { type: String, required: true }, // "YYYY-MM"
    tokensUsed: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

orgAiUsageSchema.index({ organization: 1, period: 1 }, { unique: true });

export const OrgAiUsage = mongoose.model("OrgAiUsage", orgAiUsageSchema);
