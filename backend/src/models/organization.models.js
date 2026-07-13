import mongoose, { Schema } from "mongoose";

// ─── Organization Schema ──────────────────────────────────────────────────────
// The top-level tenant boundary. Every User and Project belongs to exactly one
// Organization. All data isolation (tasks, subtasks, notes, activity) is derived
// from this scope via the parent Project — see attachProject (Phase 3).
const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [100, "Organization name cannot exceed 100 characters"],
    },

    // URL-safe unique identifier, e.g. "acme-inc" — used in routes/invites.
    slug: {
      type: String,
      required: [true, "Organization slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug may only contain lowercase letters, numbers, and single hyphens",
      ],
      index: true,
    },

    // The user who created the organization (the initial owner).
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

export const Organization = mongoose.model("Organization", organizationSchema);
