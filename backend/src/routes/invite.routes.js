import { Router } from "express";
import { body, param } from "express-validator";
import {
  createInvite,
  listInvites,
  revokeInvite,
  getInviteByToken,
  acceptInvite,
} from "../controllers/invite.controllers.js";
import { verifyJWT, checkOrgRole } from "../middlewares/auth.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import { OrgRolesEnum, AvailableOrgRole } from "../utils/constants.js";

const router = Router();

// Reused token param validator — mirrors the email-verification token shape
// (32 random bytes -> 64 hex chars).
const tokenParam = param("token")
  .notEmpty()
  .withMessage("Invite token is required")
  .isHexadecimal()
  .withMessage("Invalid token format")
  .isLength({ min: 64, max: 64 })
  .withMessage("Invalid token length");

// ─── POST /invites ────────────────────────────────────────────────────────────
// Create an invite into the caller's own org. Owner/admin only.
router.post(
  "/",
  verifyJWT,
  checkOrgRole(OrgRolesEnum.ADMIN),
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Must be a valid email address")
      .normalizeEmail(),
    body("role")
      .optional()
      .isIn(AvailableOrgRole)
      .withMessage("Role must be owner, admin, or member"),
  ],
  validate,
  createInvite,
);

// ─── GET /invites ─────────────────────────────────────────────────────────────
// List pending invites for the caller's org. Owner/admin. Declared before the
// public "/:token" route (exact "/" match, no overlap, but explicit is clearer).
router.get("/", verifyJWT, checkOrgRole(OrgRolesEnum.ADMIN), listInvites);

// ─── DELETE /invites/:inviteId ────────────────────────────────────────────────
// Revoke a pending invite. Owner/admin.
router.delete(
  "/:inviteId",
  verifyJWT,
  checkOrgRole(OrgRolesEnum.ADMIN),
  [param("inviteId").isMongoId().withMessage("Invalid invite ID")],
  validate,
  revokeInvite,
);

// ─── GET /invites/:token ──────────────────────────────────────────────────────
// Public — validate/preview an invite for the accept page.
router.get("/:token", [tokenParam], validate, getInviteByToken);

// ─── POST /invites/:token/accept ──────────────────────────────────────────────
// Public — complete registration and join the org.
router.post(
  "/:token/accept",
  [
    tokenParam,
    body("username")
      .trim()
      .notEmpty()
      .withMessage("Username is required")
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be 3–30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Username can only contain letters, numbers, and underscores"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one number"),
    body("fullName")
      .optional()
      .trim()
      .isLength({ max: 60 })
      .withMessage("Full name cannot exceed 60 characters"),
  ],
  validate,
  acceptInvite,
);

export default router;
