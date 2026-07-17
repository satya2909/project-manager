import mongoose, { Schema } from "mongoose";

// Per-org AI DoD configuration (plans/PRD_v2.md §5.10). Checked at Node 1
// (resolveContext) — killSwitch or mode:'off' short-circuits the whole run
// before any GitHub/LLM call is made.
const orgAiSettingsSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    mode: { type: String, enum: ["off", "advisory", "blocking"], default: "advisory" },
    killSwitch: { type: Boolean, default: false },
    monthlyTokenQuota: { type: Number, default: 2_000_000 },
  },
  { timestamps: true },
);

export const OrgAiSettings = mongoose.model("OrgAiSettings", orgAiSettingsSchema);
