import mongoose, { Schema } from "mongoose";

// ─── Activity Schema ──────────────────────────────────────────────────────────
// Append-only audit log for project-scoped events.
// Written by controllers; never updated or deleted by the app.
const activitySchema = new Schema(
  {
    // Which project this event belongs to
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // Who performed the action — optional ONLY for system/webhook-triggered
    // events (e.g. ai_dod_merged_unevidenced), which have no acting human.
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.action !== "ai_dod_merged_unevidenced";
      },
    },

    // Machine-readable action key — one of the ACTION_TYPES constants below
    action: {
      type: String,
      required: true,
      enum: [
        "created_task",
        "updated_task",
        "moved_task", // status change specifically
        "rescheduled_task", // startDate/dueDate change
        "linked_dependency",
        "unlinked_dependency",
        "deleted_task",
        "created_subtask",
        "completed_subtask",
        "uncompleted_subtask",
        "deleted_subtask",
        "created_note",
        "updated_note",
        "deleted_note",
        "added_member",
        "updated_role",
        "removed_member",
        // System-generated (Phase 3, plans/ai-dod-plan.md §6.5) — a PR merged
        // while its task's AI verification was still 'blocked'. No LLM calls,
        // zero cost, and arguably more valuable than the gate itself: it's
        // the exact information asymmetry this feature exists to close.
        "ai_dod_merged_unevidenced",
      ],
    },

    // Human-readable label for the target entity (task title, member name, etc.)
    target: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    // Flexible extra context (from/to status, old/new role, etc.)
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // createdAt is the event timestamp; updatedAt unused
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary query: "latest N events for project X"
activitySchema.index({ project: 1, createdAt: -1 });

// Secondary: "all events by user X across all projects"
activitySchema.index({ user: 1, createdAt: -1 });

export const Activity = mongoose.model("Activity", activitySchema);
