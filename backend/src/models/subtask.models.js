import mongoose, { Schema } from "mongoose";

// ─── SubTask Schema ───────────────────────────────────────────────────────────
// SubTasks live in their own collection (not embedded in Task) so they can:
//   - Be queried independently (e.g. "all incomplete subtasks assigned to me")
//   - Have their own assignee (different from the parent task)
//   - Be updated atomically without rewriting the entire Task document
const subTaskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Subtask title is required"],
      trim: true,
      minlength: [2, "Subtask title must be at least 2 characters"],
      maxlength: [200, "Subtask title cannot exceed 200 characters"],
    },

    // Reference back to the parent task
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },

    // Who is responsible for completing this subtask
    // Can differ from the parent task's assignedTo
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Who created this subtask (must be Admin or Project Admin)
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Members can flip this to true; Admins/Project Admins can set either way
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Most common query: "get all subtasks for task X"
subTaskSchema.index({ task: 1 });

// "get all incomplete subtasks assigned to user X" (used in personal dashboard)
subTaskSchema.index({ assignedTo: 1, isCompleted: 1 });

export const SubTask = mongoose.model("SubTask", subTaskSchema);
