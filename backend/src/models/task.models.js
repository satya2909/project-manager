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

// ─── Virtuals ─────────────────────────────────────────────────────────────────

// Populate subtasks via virtual — avoids embedding and keeps collection separate
taskSchema.virtual("subTasks", {
  ref: "SubTask",
  localField: "_id",
  foreignField: "task",
});

export const Task = mongoose.model("Task", taskSchema);
