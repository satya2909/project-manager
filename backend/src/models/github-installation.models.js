import mongoose, { Schema } from "mongoose";

// ─── GithubInstallation Schema ─────────────────────────────────────────────────
// One org : one GitHub App installation (plans/PRD_v2.md §5.8) — matches the
// existing one-user-one-org simplifying constraint. The webhook resolution
// chain (PRD §4.1) goes installation.id -> this doc -> organization, which is
// only trustworthy if installationId is globally unique, not just per-org.
const githubInstallationSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },

    // GitHub's own installation ID — globally unique across all of GitHub,
    // not scoped to our app. The webhook handler resolves org from this.
    installationId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    // The GitHub org/user account that installed the app.
    accountLogin: {
      type: String,
      required: true,
    },

    // Refreshed on `installation_repositories` events (Phase 3+).
    repositories: {
      type: [
        {
          githubId: { type: Number, required: true },
          fullName: { type: String, required: true },
          defaultBranch: { type: String, required: true },
        },
      ],
      default: [],
    },

    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },

    installedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const GithubInstallation = mongoose.model(
  "GithubInstallation",
  githubInstallationSchema,
);
