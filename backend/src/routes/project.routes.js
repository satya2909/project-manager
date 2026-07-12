import { Router } from "express";
import { body, param } from "express-validator";
import {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  updateMemberRole,
  removeProjectMember,
} from "../controllers/project.controllers.js";
import {
  verifyJWT,
  checkProjectRole,
  checkGlobalRole,
} from "../middlewares/auth.middlewares.js";
import { attachProject } from "../middlewares/project.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import { UserRolesEnum } from "../utils/constants.js";

const router = Router();

// All project routes require a valid access token
router.use(verifyJWT);

// ─── /projects ────────────────────────────────────────────────────────────────

router
  .route("/")
  .get(getUserProjects)
  .post(
    checkGlobalRole(UserRolesEnum.PROJECT_ADMIN),
    [
      body("name")
        .trim()
        .notEmpty()
        .withMessage("Project name is required")
        .isLength({ min: 3, max: 100 })
        .withMessage("Name must be 3–100 characters"),
      body("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    ],
    validate,
    createProject,
  );

// ─── /projects/:projectId ─────────────────────────────────────────────────────
// Middleware chain: verifyJWT (above) → attachProject → checkProjectRole → controller

router
  .route("/:projectId")
  .get(attachProject, getProjectById)
  .put(
    attachProject,
    checkProjectRole(UserRolesEnum.ADMIN),
    [
      body("name")
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage("Name must be 3–100 characters"),
      body("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    ],
    validate,
    updateProject,
  )
  .delete(attachProject, checkProjectRole(UserRolesEnum.ADMIN), deleteProject);

// ─── /projects/:projectId/members ─────────────────────────────────────────────

router
  .route("/:projectId/members")
  .get(attachProject, getProjectMembers)
  .post(
    attachProject,
    checkProjectRole(UserRolesEnum.ADMIN),
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
        .isIn(Object.values(UserRolesEnum))
        .withMessage("Role must be admin, project_admin, or member"),
    ],
    validate,
    addProjectMember,
  );

router
  .route("/:projectId/members/:userId")
  .put(
    attachProject,
    checkProjectRole(UserRolesEnum.ADMIN),
    [
      param("userId")
        .notEmpty()
        .withMessage("User ID is required")
        .isMongoId()
        .withMessage("Invalid user ID"),
      body("role")
        .notEmpty()
        .withMessage("Role is required")
        .isIn(Object.values(UserRolesEnum))
        .withMessage("Role must be admin, project_admin, or member"),
    ],
    validate,
    updateMemberRole,
  )
  .delete(
    attachProject,
    checkProjectRole(UserRolesEnum.ADMIN),
    [
      param("userId")
        .notEmpty()
        .withMessage("User ID is required")
        .isMongoId()
        .withMessage("Invalid user ID"),
    ],
    validate,
    removeProjectMember,
  );

export default router;
