import crypto from "crypto";
import { Invite, User, Organization } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cookieOptions, OrgRolesEnum, INVITE_EMAIL_CONCURRENCY } from "../utils/constants.js";
import { sendOrgInviteEmail } from "../utils/mail.js";
import { parseInviteSheet } from "../utils/spreadsheet.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// sha256 the raw token — only the hash is ever stored / compared.
const hashToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

// Single source of truth for invite-email shape (shared by single + bulk).
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Validate an org-invite role. Returns null when valid, or { status, reason }.
// Owner is never invitable (403); anything other than admin/member is a 400.
// Both createInvite and bulkCreateInvites use this so their rules can't drift.
const inviteRoleError = (role) => {
  if (role === OrgRolesEnum.OWNER) {
    return { status: 403, reason: "Owner cannot be assigned via invite" };
  }
  if (![OrgRolesEnum.ADMIN, OrgRolesEnum.MEMBER].includes(role)) {
    return { status: 400, reason: "Invalid role. Must be admin or member" };
  }
  return null;
};

// Run an async worker over items with a bounded concurrency so a large batch of
// invite emails doesn't hammer the SMTP provider. Preserves input order.
const runThrottled = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const lanes = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await worker(items[i], i);
      }
    },
  );
  await Promise.all(lanes);
  return results;
};

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
  const roleErr = inviteRoleError(role);
  if (roleErr) {
    throw new ApiError(roleErr.status, roleErr.reason);
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

// ─── POST /invites/bulk ───────────────────────────────────────────────────────
// Owner/admin uploads a spreadsheet (name, email, role columns). Each valid row
// becomes a pending invite and gets an email. Partial success is the norm: the
// request always returns 200 with a per-row report. An invite whose email fails
// to send is KEPT (listed under failedEmail) so the admin can resend later.
export const bulkCreateInvites = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw new ApiError(400, "No file uploaded. Attach a spreadsheet as 'file'.");
  }

  const organizationId = req.user.organization;

  // ── Parse (structural errors → 400) ──
  let parsed;
  try {
    parsed = await parseInviteSheet(req.file.buffer);
  } catch (err) {
    throw new ApiError(400, err.message);
  }

  const skipped = []; // { rowNumber, email, reason } — intentionally not invited
  const failed = []; //  { rowNumber, email, reason } — invalid row data
  const seen = new Set(); // in-file dedupe by email
  const candidates = []; // { rowNumber, email, role, name }

  // ── Per-row validation (reuses the single-invite predicates) ──
  for (const { rowNumber, email, role, name } of parsed.rows) {
    if (!EMAIL_RE.test(email)) {
      failed.push({ rowNumber, email, reason: "Invalid email address" });
      continue;
    }
    const roleValue = role || OrgRolesEnum.MEMBER; // blank role → member
    const roleErr = inviteRoleError(roleValue);
    if (roleErr) {
      failed.push({ rowNumber, email, reason: roleErr.reason });
      continue;
    }
    if (seen.has(email)) {
      skipped.push({ rowNumber, email, reason: "Duplicate row in file" });
      continue;
    }
    seen.add(email);
    candidates.push({ rowNumber, email, role: roleValue, name });
  }

  // ── Batch pre-checks: two queries total, regardless of row count ──
  const emails = candidates.map((c) => c.email);
  let existingUserEmails = new Set();
  let pendingInviteEmails = new Set();
  if (emails.length) {
    const [users, pendings] = await Promise.all([
      User.find({ email: { $in: emails } }).select("email").lean(),
      Invite.find({
        organization: organizationId,
        email: { $in: emails },
        status: "pending",
      })
        .select("email")
        .lean(),
    ]);
    existingUserEmails = new Set(users.map((u) => u.email));
    pendingInviteEmails = new Set(pendings.map((i) => i.email));
  }

  // Emails that already belong to an account can't be invited into another org.
  const toCreate = [];
  for (const c of candidates) {
    if (existingUserEmails.has(c.email)) {
      skipped.push({
        rowNumber: c.rowNumber,
        email: c.email,
        reason: "An account with this email already exists",
      });
      continue;
    }
    toCreate.push(c);
  }

  const sent = []; //        { rowNumber, email, role }
  const failedEmail = []; // { rowNumber, email, reason } — invite kept, email failed

  if (toCreate.length) {
    // Supersede prior pending invites for these emails in one query.
    const supersedeEmails = toCreate
      .filter((c) => pendingInviteEmails.has(c.email))
      .map((c) => c.email);
    if (supersedeEmails.length) {
      await Invite.updateMany(
        {
          organization: organizationId,
          email: { $in: supersedeEmails },
          status: "pending",
        },
        { $set: { status: "revoked" } },
      );
    }

    // Build docs with fresh raw tokens; keep raw token keyed by email for emailing.
    const rawByEmail = new Map();
    const docs = toCreate.map((c) => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      rawByEmail.set(c.email, rawToken);
      return {
        organization: organizationId,
        email: c.email,
        role: c.role,
        invitedName: c.name || "",
        token: hashToken(rawToken),
        invitedBy: req.user._id,
      };
    });

    // insertMany, unordered so a rare token collision on one row doesn't abort
    // the rest. On partial failure, mongoose exposes what inserted.
    let inserted = [];
    try {
      inserted = await Invite.insertMany(docs, { ordered: false });
    } catch (err) {
      inserted = err.insertedDocs || [];
    }

    // Any candidate that didn't make it into the DB is a hard failure.
    const insertedEmails = new Set(inserted.map((d) => d.email));
    for (const c of toCreate) {
      if (!insertedEmails.has(c.email)) {
        failed.push({
          rowNumber: c.rowNumber,
          email: c.email,
          reason: "Could not create invite. Please retry this row.",
        });
      }
    }

    // Correlate inserted docs back to their source row for the report.
    const rowByEmail = new Map(toCreate.map((c) => [c.email, c]));
    const org = await Organization.findById(organizationId).select("name");
    const orgName = org?.name;

    // Throttled email dispatch. A send failure keeps the invite (admin resends).
    await runThrottled(inserted, INVITE_EMAIL_CONCURRENCY, async (doc) => {
      const meta = rowByEmail.get(doc.email);
      const raw = rawByEmail.get(doc.email);
      try {
        await sendOrgInviteEmail(
          doc.email,
          orgName,
          req.user.username,
          doc.role,
          raw,
          doc.invitedName,
        );
        sent.push({ rowNumber: meta.rowNumber, email: doc.email, role: doc.role });
      } catch (e) {
        failedEmail.push({
          rowNumber: meta.rowNumber,
          email: doc.email,
          reason: `Invite created but email failed: ${e.message}`,
        });
      }
    });
  }

  // One structured summary line — makes "why did N people get invited" answerable.
  console.log(
    `[BulkInvite] org=${organizationId} actor=${req.user._id} total=${parsed.rows.length} sent=${sent.length} skipped=${skipped.length} failed=${failed.length} failedEmail=${failedEmail.length}`,
  );

  return res.status(200).json(
    new ApiResponses(
      200,
      {
        total: parsed.rows.length,
        summary: {
          sent: sent.length,
          skipped: skipped.length,
          failed: failed.length,
          failedEmail: failedEmail.length,
        },
        sent,
        skipped,
        failed,
        failedEmail,
      },
      "Bulk invite processed",
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
      // Fall back to the name captured at invite time (e.g. bulk-upload sheet)
      // when the invitee didn't type one on the accept page.
      fullName: fullName?.trim() || invite.invitedName || undefined,
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
