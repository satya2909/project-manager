import mongoose, { Schema } from "mongoose";
import { AvailableOrgRole, OrgRolesEnum } from "../utils/constants.js";

// ─── Invite Schema ────────────────────────────────────────────────────────────
// Represents a pending invitation for someone to join an Organization with a
// given role. A crypto-random token is emailed to the invitee (unhashed); only
// its sha256 HASH is stored here — same pattern as email-verification / password
// -reset tokens, so a DB read leak can't reuse live invite tokens. Role is the
// ORG-level role the invitee will hold on joining (see AvailableOrgRole).
const inviteSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: [true, "Invitee email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },

    role: {
      type: String,
      enum: AvailableOrgRole,
      required: true,
      default: OrgRolesEnum.MEMBER,
    },

    // sha256 hash of the single-use token. The raw token is only ever emailed
    // to the invitee; lookups hash the incoming token before matching here.
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      // Invites are valid for 7 days by default.
      default: () => Date.now() + 7 * 24 * 60 * 60 * 1000,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "revoked"],
      default: "pending",
    },

    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Fast lookup for "is there already a pending invite for this email in this org?"
inviteSchema.index({ organization: 1, email: 1 });

export const Invite = mongoose.model("Invite", inviteSchema);
