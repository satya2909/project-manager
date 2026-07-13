import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User, Organization } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cookieOptions, OrgRolesEnum } from "../utils/constants.js";
import { generateUniqueOrgSlug } from "../utils/slug.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/mail.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Generate both tokens, persist refreshToken to DB, return both
const generateTokens = async (userId) => {
  const user = await User.findById(userId);
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

// Set both tokens as httpOnly cookies and return them in the response body
const sendTokenResponse = (res, statusCode, data, message, tokens) => {
  const { accessToken, refreshToken } = tokens;
  return res
    .status(statusCode)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json(new ApiResponses(statusCode, data, message));
};

// ─── POST /auth/register ──────────────────────────────────────────────────────
// New-org signup: creates a fresh Organization and makes the registering user
// its owner. Invite acceptance is a separate flow (POST /invites/:token/accept).
export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, organizationName } = req.body;

  // Check for existing user
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (existingUser) {
    throw new ApiError(
      409,
      existingUser.email === email
        ? "An account with this email already exists"
        : "This username is already taken",
    );
  }

  // Create user (password is hashed by pre-save hook). Organization is attached
  // below; if org creation fails we compensate by deleting this user, since we
  // can't rely on multi-document transactions (no replica set assumed).
  const user = await User.create({ username, email, password, fullName });

  let organization;
  try {
    const slug = await generateUniqueOrgSlug(organizationName);
    organization = await Organization.create({
      name: organizationName,
      slug,
      createdBy: user._id,
    });
    user.organization = organization._id;
    user.role = OrgRolesEnum.OWNER;
    await user.save({ validateBeforeSave: false });
  } catch (err) {
    // Roll back partial state so a failed signup doesn't orphan records.
    if (organization) await Organization.findByIdAndDelete(organization._id);
    await User.findByIdAndDelete(user._id);
    throw err;
  }

  // Generate and store verification token
  const { unhashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();
  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  // Send verification email (non-blocking — failure won't break registration)
  await sendVerificationEmail(user.email, user.username, unhashedToken);

  const safeUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -forgotPasswordToken",
  );

  return res
    .status(201)
    .json(
      new ApiResponses(
        201,
        { user: safeUser },
        "Account created. Please check your email to verify your account.",
      ),
    );
});

// ─── GET /auth/verify-email/:verificationToken ────────────────────────────────
export const verifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.params;

  if (!verificationToken) {
    throw new ApiError(400, "Verification token is missing");
  }

  // Hash the token from the URL to compare against the stored hash
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  }).select("+emailVerificationToken +emailVerificationExpiry");

  if (!user) {
    throw new ApiError(400, "Verification token is invalid or has expired");
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        {},
        "Email verified successfully. You can now log in.",
      ),
    );
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // password field is select:false — must explicitly include it
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.status === "deactivated") {
    throw new ApiError(403, "Your account has been deactivated");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      "Please verify your email address before logging in",
    );
  }

  const tokens = await generateTokens(user._id);

  const safeUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -forgotPasswordToken",
  );

  return sendTokenResponse(
    res,
    200,
    { user: safeUser },
    "Logged in successfully",
    tokens,
  );
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
export const logoutUser = asyncHandler(async (req, res) => {
  // Clear refresh token from DB so it can't be reused
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } },
    { new: true },
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponses(200, {}, "Logged out successfully"));
});

// ─── GET /auth/current-user ───────────────────────────────────────────────────
export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponses(200, { user: req.user }, "Current user fetched"));
});

// ─── POST /auth/refresh-token ─────────────────────────────────────────────────
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  let decoded;
  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decoded._id).select("+refreshToken");
  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token mismatch — please log in again");
  }

  if (user.status === "deactivated") {
    throw new ApiError(401, "Your account has been deactivated");
  }

  const tokens = await generateTokens(user._id);

  return sendTokenResponse(res, 200, {}, "Access token refreshed", tokens);
});

// ─── POST /auth/change-password ───────────────────────────────────────────────
export const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      400,
      "New password must be different from the current password",
    );
  }

  const user = await User.findById(req.user._id).select("+password");
  const isPasswordValid = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = newPassword;
  await user.save(); // triggers pre-save hash hook

  return res
    .status(200)
    .json(new ApiResponses(200, {}, "Password changed successfully"));
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });

  // Always respond with 200 — don't reveal whether the email exists
  if (!user) {
    return res
      .status(200)
      .json(
        new ApiResponses(
          200,
          {},
          "If an account with this email exists, a reset link has been sent",
        ),
      );
  }

  const { unhashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail(user.email, user.username, unhashedToken);

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        {},
        "If an account with this email exists, a reset link has been sent",
      ),
    );
});

// ─── POST /auth/reset-password/:resetToken ────────────────────────────────────
export const resetForgottenPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;

  if (!resetToken || !newPassword) {
    throw new ApiError(400, "Reset token and new password are required");
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  }).select("+forgotPasswordToken +forgotPasswordExpiry");

  if (!user) {
    throw new ApiError(400, "Reset token is invalid or has expired");
  }

  user.password = newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  user.refreshToken = undefined; // invalidate all existing sessions
  await user.save();

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        {},
        "Password reset successfully. Please log in with your new password.",
      ),
    );
});

// ─── POST /auth/resend-email-verification ─────────────────────────────────────
export const resendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+emailVerificationToken +emailVerificationExpiry",
  );

  if (user.isEmailVerified) {
    throw new ApiError(400, "Your email is already verified");
  }

  const { unhashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  await sendVerificationEmail(user.email, user.username, unhashedToken);

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        {},
        "Verification email resent. Please check your inbox.",
      ),
    );
});
