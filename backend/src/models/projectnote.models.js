import mongoose, { Schema } from "mongoose";

// ─── ProjectNote Schema ───────────────────────────────────────────────────────
// Notes are project-scoped documents. Only Admins can create/update/delete them,
// but all project members (including Project Admins and Members) can read them.
// The access control is enforced at the route/controller layer, not here.
const projectNoteSchema = new Schema(
  {
    // Short heading for the note — shown in the note card header
    title: {
      type: String,
      required: [true, "Note title is required"],
      trim: true,
      minlength: [2, "Note title must be at least 2 characters"],
      maxlength: [150, "Note title cannot exceed 150 characters"],
    },

    // The main body of the note — supports plain text or markdown
    content: {
      type: String,
      required: [true, "Note content is required"],
      trim: true,
      minlength: [1, "Note content cannot be empty"],
      maxlength: [10000, "Note content cannot exceed 10,000 characters"],
    },

    // Which project this note belongs to
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // The admin who created this note
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true, // updatedAt tells us when the note was last edited
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Most common query: "list all notes for project X, newest first"
projectNoteSchema.index({ project: 1, createdAt: -1 });

export const ProjectNote = mongoose.model("ProjectNote", projectNoteSchema);
