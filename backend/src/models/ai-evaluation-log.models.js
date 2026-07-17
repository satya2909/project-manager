import mongoose, { Schema } from "mongoose";

// ─── Finding (embedded) ─────────────────────────────────────────────────────────
// Per-requirement result. `status: 'met'` requires at least one verified
// citation (Phase 4 enforces this) — a finding whose citations all fail
// verification downgrades to 'unverified' and doesn't count toward
// requirementsMet (plans/PRD_v2.md §5.4).
const findingSchema = new Schema(
  {
    requirementId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ["met", "unmet", "unverified"], required: true },
    citations: {
      type: [
        {
          path: String,
          startLine: Number,
          endLine: Number,
          symbol: String,
          verified: Boolean,
        },
      ],
      default: [],
    },
    rationale: { type: String, default: "" },
  },
  { _id: false },
);

// ─── AiEvaluationLog Schema ─────────────────────────────────────────────────────
// Append-only. `organization` is explicit and required — the worker has no
// req.project, so it can't inherit tenant isolation from attachProject the
// way HTTP controllers do (plans/PRD_v2.md §5.3).
const aiEvaluationLogSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },

    evaluationSeq: { type: Number, required: true },
    headSha: { type: String, required: true },
    trigger: { type: String, enum: ["push", "pull_request", "manual", "merge"], required: true },
    status: {
      type: String,
      enum: ["COMPLETED", "PASSED_BY_SYSTEM_ERROR", "SKIPPED"],
      required: true,
    },
    evaluation: { type: String, enum: ["APPROVED", "REJECTED"], default: null },

    // Computed in code (Node 10's tally), never reported by the model.
    requirementsTotal: { type: Number, default: 0 },
    requirementsMet: { type: Number, default: 0 },
    findings: { type: [findingSchema], default: [] },

    confidence: { type: Number, min: 0, max: 1, default: null },
    critique: { type: String, default: "" },
    promptVersion: { type: String, default: "v0-stub" },
    model: { type: String, default: "stub" },
    tokensUsed: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    strippedPaths: { type: [String], default: [] },
    errorCode: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// Serves the ai-logs list endpoint's own read pattern (task, newest first) —
// see /plan-eng-review's finding on this exact index shape.
aiEvaluationLogSchema.index({ task: 1, createdAt: -1 });

// TTL — 12 months retention (plans/ai-dod-plan.md §7 Ops). Mongo has no
// cascade delete; task deletion needs its own explicit cleanup, not this.
aiEvaluationLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 },
);

export const AiEvaluationLog = mongoose.model(
  "AiEvaluationLog",
  aiEvaluationLogSchema,
);
