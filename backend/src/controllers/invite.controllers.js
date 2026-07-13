import crypto from "crypto";
import { Invite, User, Organization } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cookieOptions, OrgRolesEnum } from "../utils/constants.js";
import { sendOrgInviteEmail } from "../utils/mail.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// sha256 the raw token — only the hash is ever stored / compared.
const hashToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

// Issue access + refresh tokens, persist the refresh token, set httpOnly cookies.
const issueSession = async (res, statusCode, user, message) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const safeUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -forgotPasswordToken",
  );

  return res
    .status(statusCode)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json(new ApiResponses(statusCode, { user: safeUser }, message));
};

// ─── POST /invites ────────────────────────────────────────────────────────────
// Owner/admin (gated by checkOrgRole) invites an email into THEIR org. The org
// is always the caller's own — never taken from the request.
export const createInvite = asyncHandler(async (req, res) => {
  const { email, role = OrgRolesEnum.MEMBER } = req.body;
  const organizationId = req.user.organization;

  // owner is never invitable — ownership is transferred explicitly, not granted.
  if (role === OrgRolesEnum.OWNER) {
    throw new ApiError(403, "Owner cannot be assigned via invite");
  }
  if (![OrgRolesEnum.ADMIN, OrgRolesEnum.MEMBER].includes(role)) {
    throw new ApiError(400, "Invalid role. Must be admin or member");
  }

  // An account already exists for this email — a user belongs to exactly one
  // org, so they can't be invited into another.
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(
      409,
      "An account with this email already exists and cannot be invited",
    );
  }

  // Supersede any prior pending invite for this email in this org.
  await Invite.updateMany(
    { organization: organizationId, email, status: "pending" },
    { $set: { status: "revoked" } },
  );

  const rawToken = crypto.randomBytes(32).toString("hex");
  const invite = await Invite.create({
    organization: organizationId,
    email,
    role,
    token: hashToken(rawToken),
    invitedBy: req.user._id,
  });

  const org = await Organization.findById(organizationId).select("name");
  await sendOrgInviteEmail(email, org?.name, req.user.username, role, rawToken);

  return res.status(201).json(
    new ApiResponses(
      201,
      {
        invite: {
          _id: invite._id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
        },
      },
      "Invitation sent",
    ),
  );
});

// ─── GET /invites ─────────────────────────────────────────────────────────────
// List pending invites for the caller's org. Owner/admin (gated by checkOrgRole).
export const listInvites = asyncHandler(async (req, res) => {
  const invites = await Invite.find({
    organization: req.user.organization,
    status: "pending",
  })
    .populate("invitedBy", "username fullName")
    .sort({ createdAt: -1 })
    .select("email role status expiresAt invitedBy createdAt");

  return res
    .status(200)
    .json(new ApiResponses(200, { invites }, "Invites fetched"));
});

// ─── DELETE /invites/:inviteId ────────────────────────────────────────────────
// Revoke a pending invite in the caller's org. Owner/admin.
export const revokeInvite = asyncHandler(async (req, res) => {
  const { inviteId } = req.params;

  const invite = await Invite.findOne({
    _id: inviteId,
    organization: req.user.organization,
  });
  if (!invite) {
    throw new ApiError(404, "Invite not found");
  }
  if (invite.status !== "pending") {
    throw new ApiError(409, `Invite is already ${invite.status}`);
  }

  invite.status = "revoked";
  await invite.save();

  return res.status(200).json(new ApiResponses(200, {}, "Invite revoked"));
});

// ─── GET /invites/:token ──────────────────────────────────────────────────────
// Public preview for the accept-invite page. Never echoes the token back.
export const getInviteByToken = asyncHandler(async (req, res) => {
  const invite = await Invite.findOne({
    token: hashToken(req.params.token),
    status: "pending",
    expiresAt: { $gt: Date.now() },
  }).populate("organization", "name slug");

  if (!invite) {
    throw new ApiError(400, "This invitation is invalid or has expired");
  }

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        invite: {
          email: invite.email,
          role: invite.role,
          organization: invite.organization,
        },
      },
      "Invitation is valid",
    ),
  );
});

// ─── POST /invites/:token/accept ──────────────────────────────────────────────
// Completes registration for an invited email and attaches the new user to the
// org at the pre-assigned role. Email is taken from the invite (not the body)
// and is treated as verified — the token proves the invitee controls it.
export const acceptInvite = asyncHandler(async (req, res) => {
  const { username, password, fullName } = req.body;

  // Atomically claim the token (pending -> accepted). This is the single-use
  // guard: a concurrent second request finds nothing to flip and is rejected.
  const invite = await Invite.findOneAndUpdate(
    {
      token: hashToken(req.params.token),
      status: "pending",
      expiresAt: { $gt: Date.now() },
    },
    { $set: { status: "accepted" } },
    { new: true },
  );

  if (!invite) {
    throw new ApiError(400, "This invitation is invalid, expired, or already used");
  }

  try {
    // The invite's email can't already be registered (checked at invite time,
    // re-checked here); username must be free.
    const clash = await User.findOne({
      $or: [{ email: invite.email }, { username }],
    });
    if (clash) {
      throw new ApiError(
        409,
        clash.email === invite.email
          ? "An account with this email already exists"
          : "This username is already taken",
      );
    }

    const user = await User.create({
      username,
      email: invite.email,
      password,
      fullName,
      organization: invite.organization,
      role: invite.role,
      isEmailVerified: true,
    });

    return await issueSession(
      res,
      201,
      user,
      "Invitation accepted. Welcome aboard!",
    );
  } catch (err) {
    // Roll the token back to pending so a recoverable failure (e.g. taken
    // username) doesn't burn the invitation.
    await Invite.findByIdAndUpdate(invite._id, { $set: { status: "pending" } });
    throw err;
  }
});
