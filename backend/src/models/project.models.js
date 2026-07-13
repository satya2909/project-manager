import mongoose, { Schema } from "mongoose";
import { AvailableProjectRole, ProjectRolesEnum } from "../utils/constants.js";

// ─── Sub-schema: Project Member ───────────────────────────────────────────────
// Each member entry tracks which user belongs to this project and what role
// they hold within it. A user's global role (on the User model) is separate
// from their project-level role here.
const projectMemberSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: AvailableProjectRole,
      default: ProjectRolesEnum.MEMBER,
    },
  },
  { _id: false }, // no separate _id for embedded sub-docs
);

// ─── Project Schema ───────────────────────────────────────────────────────────
const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: [3, "Project name must be at least 3 characters"],
      maxlength: [100, "Project name cannot exceed 100 characters"],
    },

    // The organization this project belongs to (tenant boundary).
    // Optional for now so existing projects can be backfilled by the migration;
    // flip to `required: true` after backfill (Phase 1 migration step 4).
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    // The user who created the project; automatically becomes admin
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // All users who have access to this project, including the creator
    // Index on members.user enables fast lookup: "which projects is this user in?"
    members: {
      type: [projectMemberSchema],
      default: [],
      validate: {
        validator: function (members) {
          // Ensure no duplicate user IDs in the members array
          const ids = members.map((m) => m.user.toString());
          return ids.length === new Set(ids).size;
        },
        message: "A user can only be added to a project once",
      },
    },
  },
  {
    timestamps: true,
    // Virtual for member count — handy for listing endpoints
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Enables fast query: "find all projects where this userId is a member"
projectSchema.index({ "members.user": 1 });

// Enables fast query: "list all projects in this org, newest first"
projectSchema.index({ organization: 1, createdAt: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

projectSchema.virtual("memberCount").get(function () {
  return this.members.length;
});

export const Project = mongoose.model("Project", projectSchema);
