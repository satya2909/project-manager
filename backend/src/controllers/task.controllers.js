import path from "path";
import fs from "fs";
import { Task, SubTask } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import { TaskStatusEnum, UserRolesEnum } from "../utils/constants.js";

// ─── GET /tasks/:projectId ────────────────────────────────────────────────────
// List all tasks in a project. Optional ?status= and ?assignedTo= filters.
export const getProjectTasks = asyncHandler(async (req, res) => {
  const { status, assignedTo } = req.query;

  const filter = { project: req.project._id };
  if (status && Object.values(TaskStatusEnum).includes(status)) {
    filter.status = status;
  }
  if (assignedTo) {
    filter.assignedTo = assignedTo;
  }

  const tasks = await Task.find(filter)
    .populate("assignedTo", "username fullName avatar")
    .populate("createdBy", "username fullName avatar")
    .populate({
      path: "subTasks",
      select: "title isCompleted assignedTo",
      populate: { path: "assignedTo", select: "username avatar" },
    })
    .sort({ createdAt: -1 })
    .lean();

  // Append subtask completion stats for Kanban cards
  const tasksWithStats = tasks.map((t) => ({
    ...t,
    subTaskStats: {
      total: t.subTasks?.length ?? 0,
      completed: t.subTasks?.filter((s) => s.isCompleted).length ?? 0,
    },
  }));

  return res
    .status(200)
    .json(new ApiResponses(200, { tasks: tasksWithStats }, "Tasks fetched"));
});

// ─── POST /tasks/:projectId ───────────────────────────────────────────────────
// Create a task. Admin or Project Admin only (enforced by route).
export const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status } = req.body;

  // If assigning to a user, verify they're a project member
  if (assignedTo) {
    const isMember = req.project.members.some(
      (m) => m.user.toString() === assignedTo,
    );
    if (!isMember) {
      throw new ApiError(400, "Assigned user is not a member of this project");
    }
  }

  const task = await Task.create({
    title,
    description,
    project: req.project._id,
    assignedTo: assignedTo || null,
    createdBy: req.user._id,
    status: status || TaskStatusEnum.TODO,
  });

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "username fullName avatar")
    .populate("createdBy", "username fullName avatar");

  return res
    .status(201)
    .json(
      new ApiResponses(201, { task: populated }, "Task created successfully"),
    );
});

// ─── GET /tasks/:projectId/t/:taskId ─────────────────────────────────────────
export const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: req.project._id })
    .populate("assignedTo", "username fullName avatar email")
    .populate("createdBy", "username fullName avatar")
    .populate({
      path: "subTasks",
      populate: {
        path: "assignedTo createdBy",
        select: "username fullName avatar",
      },
    });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return res.status(200).json(new ApiResponses(200, { task }, "Task fetched"));
});

// ─── PUT /tasks/:projectId/t/:taskId ─────────────────────────────────────────
// Update task fields. Admin/Project Admin only — except status, which members
// can also update (handled by a dedicated PATCH endpoint if desired; here the
// controller respects the role set by the route middleware).
export const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assignedTo, status } = req.body;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Validate assignee is a project member
  if (assignedTo) {
    const isMember = req.project.members.some(
      (m) => m.user.toString() === assignedTo,
    );
    if (!isMember) {
      throw new ApiError(400, "Assigned user is not a member of this project");
    }
  }

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  if (status !== undefined) updates.status = status;

  const updatedTask = await Task.findByIdAndUpdate(
    taskId,
    { $set: updates },
    { new: true, runValidators: true },
  )
    .populate("assignedTo", "username fullName avatar")
    .populate("createdBy", "username fullName avatar")
    .populate({
      path: "subTasks",
      populate: { path: "assignedTo", select: "username avatar" },
    });

  return res
    .status(200)
    .json(new ApiResponses(200, { task: updatedTask }, "Task updated"));
});

// ─── DELETE /tasks/:projectId/t/:taskId ───────────────────────────────────────
// Deletes task + its subtasks + its uploaded files. Admin/Project Admin only.
export const deleteTask = asyncHandler(async (req, res) => {
  const { taskId, projectId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Delete all subtasks belonging to this task
  await SubTask.deleteMany({ task: taskId });

  // Remove uploaded files from disk
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "images",
    projectId,
    taskId,
  );
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }

  await Task.findByIdAndDelete(taskId);

  return res
    .status(200)
    .json(
      new ApiResponses(200, {}, "Task and its subtasks deleted successfully"),
    );
});

// ─── POST /tasks/:projectId/t/:taskId/subtasks ────────────────────────────────
// Add a subtask to an existing task. Admin/Project Admin only.
export const createSubTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, assignedTo } = req.body;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Validate assignee if provided
  if (assignedTo) {
    const isMember = req.project.members.some(
      (m) => m.user.toString() === assignedTo,
    );
    if (!isMember) {
      throw new ApiError(400, "Assigned user is not a member of this project");
    }
  }

  const subTask = await SubTask.create({
    title,
    task: taskId,
    assignedTo: assignedTo || null,
    createdBy: req.user._id,
  });

  const populated = await SubTask.findById(subTask._id)
    .populate("assignedTo", "username fullName avatar")
    .populate("createdBy", "username fullName avatar");

  return res
    .status(201)
    .json(new ApiResponses(201, { subTask: populated }, "Subtask created"));
});

// ─── PUT /tasks/:projectId/st/:subTaskId ──────────────────────────────────────
// Update a subtask. All members can toggle isCompleted.
// Only Admin/Project Admin can change title or assignedTo (enforced by route).
export const updateSubTask = asyncHandler(async (req, res) => {
  const { subTaskId, projectId } = req.params;
  const { title, isCompleted, assignedTo } = req.body;

  // Verify subtask belongs to a task in this project
  const subTask = await SubTask.findById(subTaskId).populate("task", "project");
  if (
    !subTask ||
    subTask.task.project.toString() !== req.project._id.toString()
  ) {
    throw new ApiError(404, "Subtask not found");
  }

  const isMemberRole = req.projectRole === UserRolesEnum.MEMBER;

  // Members can only toggle completion — nothing else
  if (isMemberRole && (title !== undefined || assignedTo !== undefined)) {
    throw new ApiError(
      403,
      "Members can only update subtask completion status",
    );
  }

  const updates = {};
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;

  // Admin/Project Admin only fields
  if (!isMemberRole) {
    if (title !== undefined) updates.title = title;
    if (assignedTo !== undefined) {
      const isMember = req.project.members.some(
        (m) => m.user.toString() === assignedTo,
      );
      if (!isMember) {
        throw new ApiError(
          400,
          "Assigned user is not a member of this project",
        );
      }
      updates.assignedTo = assignedTo;
    }
  }

  const updatedSubTask = await SubTask.findByIdAndUpdate(
    subTaskId,
    { $set: updates },
    { new: true, runValidators: true },
  ).populate("assignedTo createdBy", "username fullName avatar");

  return res
    .status(200)
    .json(
      new ApiResponses(200, { subTask: updatedSubTask }, "Subtask updated"),
    );
});

// ─── DELETE /tasks/:projectId/st/:subTaskId ───────────────────────────────────
// Admin/Project Admin only.
export const deleteSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;

  const subTask = await SubTask.findById(subTaskId).populate("task", "project");
  if (
    !subTask ||
    subTask.task.project.toString() !== req.project._id.toString()
  ) {
    throw new ApiError(404, "Subtask not found");
  }

  await SubTask.findByIdAndDelete(subTaskId);

  return res.status(200).json(new ApiResponses(200, {}, "Subtask deleted"));
});

// ─── POST /tasks/:projectId/t/:taskId/attachments ─────────────────────────────
// Upload files to a task. Multer middleware runs before this controller and
// populates req.files. Admin/Project Admin only.
export const addTaskAttachments = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "No files were uploaded");
  }

  // Check total attachments won't exceed limit
  const totalAfterUpload = task.attachments.length + req.files.length;
  if (totalAfterUpload > 5) {
    // Remove the uploaded files since we're rejecting
    req.files.forEach((f) => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    throw new ApiError(
      400,
      `This task already has ${task.attachments.length} attachment(s). Maximum is 5.`,
    );
  }

  // Build attachment metadata for each uploaded file
  const newAttachments = req.files.map((file) => ({
    url: `/images/${req.params.projectId}/${taskId}/${file.filename}`,
    mimetype: file.mimetype,
    size: file.size,
    originalName: file.originalname,
  }));

  const updatedTask = await Task.findByIdAndUpdate(
    taskId,
    { $push: { attachments: { $each: newAttachments } } },
    { new: true },
  ).populate("assignedTo createdBy", "username fullName avatar");

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { task: updatedTask },
        `${req.files.length} file(s) uploaded`,
      ),
    );
});

// ─── DELETE /tasks/:projectId/t/:taskId/attachments/:attachmentId ─────────────
// Remove a single attachment from a task and delete it from disk.
export const deleteTaskAttachment = asyncHandler(async (req, res) => {
  const { taskId, attachmentId, projectId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const attachment = task.attachments.id(attachmentId);
  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  // Delete file from disk
  const filePath = path.join(process.cwd(), "public", attachment.url);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const updatedTask = await Task.findByIdAndUpdate(
    taskId,
    { $pull: { attachments: { _id: attachmentId } } },
    { new: true },
  );

  return res
    .status(200)
    .json(new ApiResponses(200, { task: updatedTask }, "Attachment deleted"));
});
