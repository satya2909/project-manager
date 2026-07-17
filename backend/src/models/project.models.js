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

    // The organization this project belongs to (tenant boundary). Required:
    // createProject always sets it from the creator's org. Backfilled for legacy
    // projects by migrate:orgs.
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "A project must belong to an organization"],
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    // Human-readable task-key label, e.g. "CAMP" -> "CAMP-104". Freely
    // mutable (unlike Task.taskNumber, which is the immutable identity) —
    // see plans/PRD_v2.md §6.1. Uniqueness across keyPrefix ∪ prefixAliases
    // is enforced in the controller (Mongo can't express "unique across a
    // scalar ∪ an array" as a single index), not here.
    keyPrefix: {
      type: String,
      required: [true, "A project key prefix is required"],
      uppercase: true,
      trim: true,
      minlength: [2, "Key prefix must be 2-6 characters"],
      maxlength: [6, "Key prefix must be 2-6 characters"],
    },

    // Former prefixes, appended on every rename, never expire. Parser-only
    // (branch/PR task-key resolution) — nothing else reads this.
    prefixAliases: {
      type: [String],
      default: [],
    },

    // Atomically $inc-ed to allocate Task.taskNumber. Never `count() + 1`.
    taskCounter: {
      type: Number,
      default: 0,
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

// keyPrefix uniqueness is scoped per org, checked at the controller level
// alongside prefixAliases (see above) — this index makes the common case
// (checking the live prefix) fast, not the sole enforcement mechanism.
//
// Partial, not plain `unique: true` (found while building the Phase 1.4
// migration): a plain unique index still indexes a MISSING field as a single
// `null` entry, so every pre-migration legacy project (genuinely missing
// keyPrefix, which is exactly what the migration exists to backfill) would
// collide with every other one in the same org the moment this index built —
// a real deploy-time outage, not a test artifact. A partial index scoped to
// "keyPrefix actually exists" is the correct exclusion, same fix shape as the
// prefixAliases index below.
projectSchema.index(
  { organization: 1, keyPrefix: 1 },
  { unique: true, partialFilterExpression: { keyPrefix: { $exists: true } } },
);

// NOT `sparse: true` — a *compound* sparse index only excludes a document
// when ALL of its fields are missing, not just this one. Since `organization`
// is always present, sparse would never actually exclude anything, and every
// alias-less project (i.e. almost all of them — aliases only appear after a
// rename) would collide on the same `prefixAliases: null` index entry.
// A partial index keyed on array non-emptiness is the correct exclusion.
projectSchema.index(
  { organization: 1, prefixAliases: 1 },
  { unique: true, partialFilterExpression: { "prefixAliases.0": { $exists: true } } },
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

projectSchema.virtual("memberCount").get(function () {
  // `members` is undefined, not [], when this doc came from a narrow
  // populate() field selection that didn't include it (e.g.
  // `.populate("project", "keyPrefix")` from task.controllers.js) — this
  // virtual still runs during toJSON() regardless, so it must not assume
  // the field was loaded.
  return this.members?.length ?? 0;
});

export const Project = mongoose.model("Project", projectSchema);
