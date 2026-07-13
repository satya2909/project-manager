import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AvailableOrgRole, OrgRolesEnum } from "../utils/constants.js";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores",
      ],
      index: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
      index: true,
    },

    fullName: {
      type: String,
      trim: true,
      maxlength: [60, "Full name cannot exceed 60 characters"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // never returned in queries by default
    },

    avatar: {
      type: String, // URL to avatar image
      default: null,
    },

    // The organization this user belongs to (tenant boundary). Required: every
    // user is created via new-org signup (registerUser) or invite acceptance,
    // both of which set this. Backfilled for legacy users by migrate:orgs.
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "A user must belong to an organization"],
      index: true,
    },

    // The user's ORG-level role. One owner per org; admin manages the org;
    // member is the default. Distinct from project-level roles (Project.members).
    role: {
      type: String,
      enum: AvailableOrgRole,
      default: OrgRolesEnum.MEMBER,
    },

    // Soft-delete flag for org membership. Deactivated users cannot log in,
    // pass verifyJWT, or refresh tokens, but their createdBy/assignedTo
    // references are preserved. Enforced in loginUser / verifyJWT / refresh.
    status: {
      type: String,
      enum: ["active", "deactivated"],
      default: "active",
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // --- Email Verification ---
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpiry: {
      type: Date,
      select: false,
    },

    // --- Forgot Password ---
    forgotPasswordToken: {
      type: String,
      select: false,
    },
    forgotPasswordExpiry: {
      type: Date,
      select: false,
    },

    // --- Refresh Token ---
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  },
);

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Hash password before saving if it was modified
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Compare a plain-text password against the hashed one stored in DB
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate a short-lived access token (payload: id, email, username, role)
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" },
  );
};

// Generate a long-lived refresh token (payload: id only for minimal surface)
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};

// Generate a cryptographically secure token for email verification / password reset.
// Returns { unhashedToken, hashedToken, tokenExpiry }
// - unhashedToken is sent to the user via email (never stored)
// - hashedToken is stored in DB (safe to persist)
userSchema.methods.generateTemporaryToken = function () {
  const unhashedToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(unhashedToken)
    .digest("hex");
  const tokenExpiry = Date.now() + 20 * 60 * 1000; // 20 minutes
  return { unhashedToken, hashedToken, tokenExpiry };
};

export const User = mongoose.model("User", userSchema);
