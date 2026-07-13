import { Router } from "express";
import { body, param } from "express-validator";
import {
  getProjectTasks,
  getMyTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  createSubTask,
  updateSubTask,
  deleteSubTask,
  addTaskAttachments,
  deleteTaskAttachment,
} from "../controllers/task.controllers.js";
import {
  verifyJWT,
  checkProjectRole,
} from "../middlewares/auth.middlewares.js";
import { attachProject } from "../middlewares/project.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import { uploadTaskFiles } from "../middlewares/multer.middlewares.js";
import { ProjectRolesEnum, AvailableTaskStatus } from "../utils/constants.js";

const router = Router();

// All task routes require authentication + project membership
// attachProject handles both — it verifies JWT-user is a member
router.use(verifyJWT);

// ─── /tasks/me ────────────────────────────────────────────────────────────────
// MUST be declared before "/:projectId" so "me" is not parsed as a project id.
router.get("/me", getMyTasks);

// ─── /tasks/:projectId ────────────────────────────────────────────────────────

router
  .route("/:projectId")
  .get(attachProject, getProjectTasks)
  .post(
    attachProject,
    checkProjectRole(ProjectRolesEnum.PROJECT_ADMIN),
    [
      body("title")
        .trim()
        .notEmpty()
        .withMessage("Task title is required")
        .isLength({ min: 3, max: 150 })
        .withMessage("Title must be 3–150 characters"),
      body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Description cannot exceed 2000 characters"),
      body("assignedTo")
        .optional()
        .isMongoId()
        .withMessage("Invalid user ID for assignee"),
      body("status")
        .optional()
        .isIn(AvailableTaskStatus)
        .withMessage(
          `Status must be one of: ${AvailableTaskStatus.join(", ")}`,
        ),
    ],
    validate,
    createTask,
  );

// ─── /tasks/:projectId/t/:taskId ──────────────────────────────────────────────

router
  .route("/:projectId/t/:taskId")
  .get(
    attachProject,
    [param("taskId").isMongoId().withMessage("Invalid task ID")],
    validate,
    getTaskById,
  )
  .put(
    attachProject,
    // Authorization is field-level inside the controller: managers may edit any
    // field; a task's assignee may change status only.
    [
      param("taskId").isMongoId().withMessage("Invalid task ID"),
      body("title")
        .optional()
        .trim()
        .isLength({ min: 3, max: 150 })
        .withMessage("Title must be 3–150 characters"),
      body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Description cannot exceed 2000 characters"),
      body("assignedTo")
        .optional()
        .isMongoId()
        .withMessage("Invalid user ID for assignee"),
      body("status")
        .optional()
        .isIn(AvailableTaskStatus)
        .withMessage(
          `Status must be one of: ${AvailableTaskStatus.join(", ")}`,
        ),
    ],
    validate,
    updateTask,
  )
  .delete(
    attachProject,
    checkProjectRole(ProjectRolesEnum.PROJECT_ADMIN),
    [param("taskId").isMongoId().withMessage("Invalid task ID")],
    validate,
    deleteTask,
  );

// ─── /tasks/:projectId/t/:taskId/subtasks ─────────────────────────────────────

router.post(
  "/:projectId/t/:taskId/subtasks",
  attachProject,
  checkProjectRole(ProjectRolesEnum.PROJECT_ADMIN),
  [
    param("taskId").isMongoId().withMessage("Invalid task ID"),
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Subtask title is required")
      .isLength({ min: 2, max: 200 })
      .withMessage("Title must be 2–200 characters"),
    body("assignedTo")
      .optional()
      .isMongoId()
      .withMessage("Invalid user ID for assignee"),
  ],
  validate,
  createSubTask,
);

// ─── /tasks/:projectId/st/:subTaskId ─────────────────────────────────────────
// All members can update isCompleted. Title/assignedTo restricted in controller.

router
  .route("/:projectId/st/:subTaskId")
  .put(
    attachProject,
    [
      param("subTaskId").isMongoId().withMessage("Invalid subtask ID"),
      body("title")
        .optional()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage("Title must be 2–200 characters"),
      body("isCompleted")
        .optional()
        .isBoolean()
        .withMessage("isCompleted must be a boolean"),
      body("assignedTo")
        .optional()
        .isMongoId()
        .withMessage("Invalid user ID for assignee"),
    ],
    validate,
    updateSubTask,
  )
  .delete(
    attachProject,
    checkProjectRole(ProjectRolesEnum.PROJECT_ADMIN),
    [param("subTaskId").isMongoId().withMessage("Invalid subtask ID")],
    validate,
    deleteSubTask,
  );

// ─── /tasks/:projectId/t/:taskId/attachments ──────────────────────────────────
// uploadTaskFiles (multer) runs first, then controller saves metadata to DB

router
  .route("/:projectId/t/:taskId/attachments")
  .post(
    attachProject,
    checkProjectRole(ProjectRolesEnum.PROJECT_ADMIN),
    uploadTaskFiles,
    addTaskAttachments,
  );

router
  .route("/:projectId/t/:taskId/attachments/:attachmentId")
  .delete(
    attachProject,
    checkProjectRole(ProjectRolesEnum.PROJECT_ADMIN),
    [
      param("taskId").isMongoId().withMessage("Invalid task ID"),
      param("attachmentId").isMongoId().withMessage("Invalid attachment ID"),
    ],
    validate,
    deleteTaskAttachment,
  );

export default router;
