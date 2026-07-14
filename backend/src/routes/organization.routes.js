import { Router } from "express";
import { body, param } from "express-validator";
import {
  getMyOrg,
  updateOrg,
  deleteOrg,
  getOrgMembers,
  updateOrgMemberRole,
  deactivateOrgMember,
} from "../controllers/organization.controllers.js";
import { verifyJWT, checkOrgRole } from "../middlewares/auth.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import { OrgRolesEnum } from "../utils/constants.js";

const router = Router();

// Every org route requires authentication. The org is always the caller's own
// (req.user.organization) — there is no :orgId param to spoof.
router.use(verifyJWT);

// ─── /organizations/me ────────────────────────────────────────────────────────
router.get("/me", getMyOrg);

// ─── /organizations ───────────────────────────────────────────────────────────
router.put(
  "/",
  checkOrgRole(OrgRolesEnum.ADMIN),
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Organization name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Organization name must be 2–100 characters"),
  ],
  validate,
  updateOrg,
);

// Owner-only danger zone — blocks if the org still has members or projects.
// Requires the owner's current password: the deletion also destroys the owner's
// own account, so we re-authenticate identity server-side (the client-side
// type-to-confirm gate enforces nothing on its own).
router.delete(
  "/",
  checkOrgRole(OrgRolesEnum.OWNER),
  [
    body("password")
      .notEmpty()
      .withMessage("Password is required to delete the organization"),
  ],
  validate,
  deleteOrg,
);

// ─── /organizations/members ───────────────────────────────────────────────────
router.get("/members", getOrgMembers);

const userIdParam = param("userId")
  .notEmpty()
  .withMessage("User ID is required")
  .isMongoId()
  .withMessage("Invalid user ID");

router
  .route("/members/:userId")
  .put(
    checkOrgRole(OrgRolesEnum.OWNER),
    [
      userIdParam,
      body("role")
        .notEmpty()
        .withMessage("Role is required")
        .isIn([OrgRolesEnum.ADMIN, OrgRolesEnum.MEMBER])
        .withMessage("Role must be admin or member"),
    ],
    validate,
    updateOrgMemberRole,
  )
  .delete(
    checkOrgRole(OrgRolesEnum.ADMIN),
    [userIdParam],
    validate,
    deactivateOrgMember,
  );

export default router;
