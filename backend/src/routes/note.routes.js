import { Router } from "express";
import { body, param } from "express-validator";
import {
  getProjectNotes,
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
} from "../controllers/note.controllers.js";
import {
  verifyJWT,
  checkProjectRole,
} from "../middlewares/auth.middlewares.js";
import { attachProject } from "../middlewares/project.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import { UserRolesEnum } from "../utils/constants.js";

const router = Router();

router.use(verifyJWT);

// ─── /notes/:projectId ────────────────────────────────────────────────────────

router
  .route("/:projectId")
  .get(attachProject, getProjectNotes)
  .post(
    attachProject,
    checkProjectRole(UserRolesEnum.ADMIN),
    [
      body("title")
        .trim()
        .notEmpty()
        .withMessage("Note title is required")
        .isLength({ min: 2, max: 150 })
        .withMessage("Title must be between 2 and 150 characters"),
      body("content")
        .trim()
        .notEmpty()
        .withMessage("Note content is required")
        .isLength({ max: 10000 })
        .withMessage("Content cannot exceed 10,000 characters"),
    ],
    validate,
    createNote,
  );

// ─── /notes/:projectId/n/:noteId ─────────────────────────────────────────────

router
  .route("/:projectId/n/:noteId")
  .get(
    attachProject,
    [param("noteId").isMongoId().withMessage("Invalid note ID")],
    validate,
    getNoteById,
  )
  .put(
    attachProject,
    checkProjectRole(UserRolesEnum.ADMIN),
    [
      param("noteId").isMongoId().withMessage("Invalid note ID"),
      body("title")
        .trim()
        .notEmpty()
        .withMessage("Note title is required")
        .isLength({ min: 2, max: 150 })
        .withMessage("Title must be between 2 and 150 characters"),
      body("content")
        .trim()
        .notEmpty()
        .withMessage("Note content is required")
        .isLength({ max: 10000 })
        .withMessage("Content cannot exceed 10,000 characters"),
    ],
    validate,
    updateNote,
  )
  .delete(
    attachProject,
    checkProjectRole(UserRolesEnum.ADMIN),
    [param("noteId").isMongoId().withMessage("Invalid note ID")],
    validate,
    deleteNote,
  );

export default router;
