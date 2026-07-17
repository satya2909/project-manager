import mongoose, { Schema } from "mongoose";
import { AvailableTaskStatus, TaskStatusEnum } from "../utils/constants.js";

// ─── Sub-schema: File Attachment ──────────────────────────────────────────────
// Tracks metadata for each file uploaded to a task.
// The actual file lives at `url` (local path or cloud URL).
const attachmentSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number, // in bytes
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
  },
  { _id: true, timestamps: true }, // keep _id so we can delete individual attachments
);

// ─── Task Schema ──────────────────────────────────────────────────────────────
const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: [3, "Task title must be at least 3 characters"],
      maxlength: [150, "Task title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      default: "",
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // Immutable identity — the number half of the computed `taskKey`
    // (`${project.keyPrefix}-${taskNumber}`). Allocated atomically via
    // Project.taskCounter ($inc), never `count() + 1`. See plans/PRD_v2.md §6.1.
    taskNumber: {
      type: Number,
      required: true,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: AvailableTaskStatus,
      default: TaskStatusEnum.TODO,
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: "A task can have a maximum of 5 attachments",
      },
    },

    // ─── Timeline scheduling fields ──────────────────────────────────────────
    startDate: {
      type: Date,
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (v) {
          return !v || !this.startDate || v >= this.startDate;
        },
        message: "Due date cannot be before start date",
      },
    },

    // ─── AI DoD verification fields (Phase 3, plans/ai-dod-plan.md) ──────────
    // Populated by the first matching webhook, or set manually via the
    // "Verify now" path (Phase 4's no-PR-gap fallback).
    githubBranch: {
      type: String,
      default: null,
      index: true,
    },
    githubPrUrl: {
      type: String,
      default: null,
    },

    // NOT a boolean — a boolean can't express pending/blocked/clear/none as
    // distinct UI states (plans/PRD_v2.md §5.5). `none` = never evaluated;
    // `pending` = a run is enqueued or in flight.
    aiLockStatus: {
      type: String,
      enum: ["none", "pending", "blocked", "clear"],
      default: "none",
    },

    // Monotonic, incremented on ENQUEUE (not on completion — completion
    // order isn't issue order under unpredictable LLM latency). The
    // conditional write on persist (lastAppliedSeq: {$lt: seq}) is what
    // prevents a stale REJECTED landing after a fresh APPROVED — same
    // failure shape as the Kanban race condition (plans/PRD_v2.md §5.6).
    evaluationSeq: {
      type: Number,
      default: 0,
    },
    lastAppliedSeq: {
      type: Number,
      default: 0,
    },

    // Predecessor tasks (this task is blocked by these). Same-project validity
    // is enforced in the controller, not here — see task.controllers.js.
    dependsOn: {
      type: [{ type: Schema.Types.ObjectId, ref: "Task" }],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: "A task can depend on at most 20 other tasks",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Most common query: "get all tasks for project X filtered by status"
taskSchema.index({ project: 1, status: 1 });

// "get all tasks assigned to user X"
taskSchema.index({ assignedTo: 1 });

// Identity: unique per project. Never queried by taskKey — always
// project (from repo/route resolution) then this number.
//
// Partial, not plain `unique: true` — same reasoning as Project.keyPrefix's
// index: a plain unique index treats a MISSING taskNumber as a single `null`
// entry, so every pre-migration legacy task in the same project (exactly
// what Phase 1.4's migration exists to backfill) would collide on index
// build. Partial on "taskNumber actually exists" excludes them correctly.
taskSchema.index(
  { project: 1, taskNumber: 1 },
  { unique: true, partialFilterExpression: { taskNumber: { $exists: true } } },
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

// Populate subtasks via virtual — avoids embedding and keeps collection separate
taskSchema.virtual("subTasks", {
  ref: "SubTask",
  localField: "_id",
  foreignField: "task",
});

// Computed at read time — never persisted (plans/PRD_v2.md §6.1). Requires
// `project` to be populated with at least `keyPrefix`; the controller should
// prefer passing the prefix down from `req.project` (already loaded by
// `attachProject`) rather than a fresh populate() where avoidable.
taskSchema.virtual("taskKey").get(function () {
  return this.project?.keyPrefix
    ? `${this.project.keyPrefix}-${this.taskNumber}`
    : null;
});

export const Task = mongoose.model("Task", taskSchema);
