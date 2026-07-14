import mongoose from "mongoose";
import { Organization, User, Project, Invite } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  OrgRolesEnum,
  OrgRoleHierarchy,
  cookieOptions,
} from "../utils/constants.js";

// Fields safe to return for any user (never password / tokens).
const SAFE_USER_FIELDS = "username fullName avatar email role status isEmailVerified createdAt";

// ─── GET /organizations/me ────────────────────────────────────────────────────
export const getMyOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.user.organization);
  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, { organization: org }, "Organization fetched"));
});

// ─── PUT /organizations ───────────────────────────────────────────────────────
// Update the caller's org. Owner/admin only (gated by checkOrgRole). Slug is
// immutable — it's the stable identifier.
export const updateOrg = asyncHandler(async (req, res) => {
  const { name } = req.body;

  const org = await Organization.findByIdAndUpdate(
    req.user.organization,
    { $set: { name } },
    { new: true, runValidators: true },
  );

  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, { organization: org }, "Organization updated"));
});

// ─── DELETE /organizations ────────────────────────────────────────────────────
// Owner-only danger zone. Because this also destroys the owner's own account,
// we re-authenticate identity by requiring the current password server-side —
// the client-side type-to-confirm gate enforces nothing on a direct API call.
// Blocks if the org still has other members or any projects (the owner must
// remove/transfer those first). A solo, project-less org is torn down entirely:
// pending invites, the org itself, and the owner's own account (a user cannot
// exist without an org), then the session is cleared.

// A transaction is only supported on a replica set / mongos. On a standalone
// mongod (e.g. local dev) startTransaction throws — detect that and degrade to
// ordered sequential deletes rather than failing the request.
const isReplicaSetUnsupported = (err) =>
  err?.code === 20 ||
  err?.codeName === "IllegalOperation" ||
  /replica set|Transaction numbers/i.test(err?.message ?? "");

export const deleteOrg = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const { password } = req.body;

  // Re-authenticate the owner before doing anything irreversible. Runs before
  // the emptiness check so a wrong password never reveals org state.
  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Incorrect password");
  }

  const [otherMembers, projectCount] = await Promise.all([
    User.countDocuments({ organization: orgId, _id: { $ne: req.user._id } }),
    Project.countDocuments({ organization: orgId }),
  ]);

  if (otherMembers > 0 || projectCount > 0) {
    throw new ApiError(
      409,
      "Remove all other members and delete all projects before deleting the organization",
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Invite.deleteMany({ organization: orgId }, { session });
      await Organization.findByIdAndDelete(orgId, { session });
      await User.findByIdAndDelete(req.user._id, { session });
    });
  } catch (err) {
    if (!isReplicaSetUnsupported(err)) throw err;
    // Standalone mongod: no transactions. Delete the owner account first so
    // that a crash mid-teardown can never leave a live login pointing at a
    // half-deleted org.
    await User.findByIdAndDelete(req.user._id);
    await Organization.findByIdAndDelete(orgId);
    await Invite.deleteMany({ organization: orgId });
  } finally {
    await session.endSession();
  }

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponses(200, {}, "Organization deleted"));
});

// ─── GET /organizations/members ───────────────────────────────────────────────
// List everyone in the caller's org, including deactivated members (with status)
// so admins can see and later reactivate them.
export const getOrgMembers = asyncHandler(async (req, res) => {
  const members = await User.find({ organization: req.user.organization })
    .select(SAFE_USER_FIELDS)
    .sort({ createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponses(200, { members }, "Members fetched"));
});

// ─── PUT /organizations/members/:userId ───────────────────────────────────────
// Change an org member's role. Owner only. Cannot set 'owner' (one owner per org
// — ownership transfer is a separate flow), cannot change your own role.
export const updateOrgMemberRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (![OrgRolesEnum.ADMIN, OrgRolesEnum.MEMBER].includes(role)) {
    throw new ApiError(400, "Role must be admin or member");
  }

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot change your own role");
  }

  const target = await User.findOne({
    _id: userId,
    organization: req.user.organization,
  });
  if (!target) {
    throw new ApiError(404, "User is not a member of this organization");
  }

  target.role = role;
  await target.save({ validateBeforeSave: false });

  const safeTarget = await User.findById(userId).select(SAFE_USER_FIELDS);

  return res
    .status(200)
    .json(new ApiResponses(200, { member: safeTarget }, "Member role updated"));
});

// ─── DELETE /organizations/members/:userId ────────────────────────────────────
// Soft-delete (deactivate) an org member. Owner/admin only. Cannot deactivate
// yourself or anyone at/above your own role. Unsets refreshToken so any live
// session dies immediately (verifyJWT will also reject on next request).
export const deactivateOrgMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot deactivate your own account");
  }

  const target = await User.findOne({
    _id: userId,
    organization: req.user.organization,
  });
  if (!target) {
    throw new ApiError(404, "User is not a member of this organization");
  }

  if (OrgRoleHierarchy[target.role] >= OrgRoleHierarchy[req.user.role]) {
    throw new ApiError(
      403,
      "You cannot deactivate a member at or above your own role",
    );
  }

  if (target.status === "deactivated") {
    throw new ApiError(409, "This member is already deactivated");
  }

  target.status = "deactivated";
  target.refreshToken = undefined; // kill any live session
  await target.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponses(200, {}, "Member deactivated"));
});
