import path from "path";
import fs from "fs";
import { Task, SubTask, Activity, Project } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import { TaskStatusEnum, ProjectRolesEnum } from "../utils/constants.js";
import { wouldCreateCycle } from "../utils/dependency-graph.js";

// Above this task count, GET /timeline and the dependency cycle-check both
// fetch the project's full task set in one query — a tripwire log, not a
// fix, so an unusually large project shows up in logs before it's a problem.
const LARGE_PROJECT_TASK_COUNT = 2000;

// ─── helper ───────────────────────────────────────────────────────────────────
// Fire-and-forget activity log — never throws so it can't break the response.
const log = (projectId, userId, action, target = "", metadata = {}) => {
  Activity.create({
    project: projectId,
    user: userId,
    action,
    target,
    metadata,
  }).catch((e) => console.error("[Activity]", e.message));
};

// ─── helper ───────────────────────────────────────────────────────────────────
// Shared by getProjectTasks/getMyTasks/getOrgTasks — each needs the same
// subtask-completion rollup on top of populated `subTasks`. GET /timeline
// does NOT use this: its payload deliberately excludes subtask data.
const withSubTaskStats = (tasks) =>
  tasks.map((t) => ({
    ...t,
    subTaskStats: {
      total: t.subTasks?.length ?? 0,
      completed: t.subTasks?.filter((s) => s.isCompleted).length ?? 0,
    },
  }));

// `.lean()` queries return plain objects — Task.taskKey's virtual getter
// never runs against them, so taskKey has to be computed by hand for every
// lean task list. Single-project endpoints (getProjectTasks, getTimeline)
// already have req.project.keyPrefix loaded via attachProject — pass it
// directly rather than populating `project` per task, which would be
// redundant data on every row. Cross-project endpoints (getMyTasks,
// getOrgTasks) populate `project` with `keyPrefix` per task instead, since
// each task can belong to a different project.
const withTaskKey = (tasks, keyPrefix) =>
  tasks.map((t) => ({
    ...t,
    taskKey: keyPrefix ? `${keyPrefix}-${t.taskNumber}` : null,
  }));

const withTaskKeyFromPopulatedProject = (tasks) =>
  tasks.map((t) => ({
    ...t,
    taskKey: t.project?.keyPrefix ? `${t.project.keyPrefix}-${t.taskNumber}` : null,
  }));

// ─── GET /tasks/:projectId ────────────────────────────────────────────────────
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

  const tasksWithStats = withTaskKey(
    withSubTaskStats(tasks),
    req.project.keyPrefix,
  );

  return res
    .status(200)
    .json(new ApiResponses(200, { tasks: tasksWithStats }, "Tasks fetched"));
});

// ─── GET /tasks/me ────────────────────────────────────────────────────────────
// Cross-project: every task assigned to the requesting user, with that user's
// role in each parent project so the client can decide edit rights.
export const getMyTasks = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const tasks = await Task.find({ assignedTo: userId })
    .populate("assignedTo", "username fullName avatar")
    .populate("createdBy", "username fullName avatar")
    .populate("project", "name keyPrefix")
    .populate({ path: "subTasks", select: "title isCompleted" })
    .sort({ project: 1, createdAt: -1 })
    .lean();

  // One query for the user's role in every project these tasks belong to.
  const projectIds = [
    ...new Set(tasks.map((t) => t.project?._id?.toString()).filter(Boolean)),
  ];
  const projects = await Project.find({
    _id: { $in: projectIds },
    "members.user": userId,
  })
    .select("members")
    .lean();

  const roleByProject = new Map();
  projects.forEach((p) => {
    const m = p.members.find((mm) => mm.user.toString() === userId.toString());
    if (m) roleByProject.set(p._id.toString(), m.role);
  });

  const tasksWithMeta = withTaskKeyFromPopulatedProject(
    withSubTaskStats(tasks),
  ).map((t) => ({
    ...t,
    myRole: roleByProject.get(t.project?._id?.toString()) ?? "member",
  }));

  return res
    .status(200)
    .json(new ApiResponses(200, { tasks: tasksWithMeta }, "My tasks fetched"));
});

// ─── GET /tasks/org ───────────────────────────────────────────────────────────
// Org-wide: every task belonging to any project in the requester's organization.
// Route-gated to owner/admin via checkOrgRole — this bypasses per-project
// membership entirely, so the route MUST NOT be reachable by plain members.
export const getOrgTasks = asyncHandler(async (req, res) => {
  const projects = await Project.find({ organization: req.user.organization })
    .select("_id")
    .lean();
  const projectIds = projects.map((p) => p._id);

  const tasks = await Task.find({ project: { $in: projectIds } })
    .populate("assignedTo", "username fullName avatar")
    .populate("createdBy", "username fullName avatar")
    .populate("project", "name keyPrefix")
    .populate({ path: "subTasks", select: "title isCompleted" })
    .sort({ project: 1, createdAt: -1 })
    .lean();

  const tasksWithStats = withTaskKeyFromPopulatedProject(
    withSubTaskStats(tasks),
  );

  return res
    .status(200)
    .json(new ApiResponses(200, { tasks: tasksWithStats }, "Org tasks fetched"));
});

// ─── GET /tasks/:projectId/timeline ────────────────────────────────────────────
// Lighter payload than getProjectTasks — no attachments/subtasks, since the
// timeline view only needs dates and dependency links. Readable by any
// project member (not manager-gated, unlike schedule/dependency mutations).
export const getTimeline = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ project: req.project._id })
    .select("title status startDate dueDate dependsOn assignedTo taskNumber")
    .populate("assignedTo", "username fullName avatar")
    .populate({ path: "dependsOn", select: "title" })
    .lean();

  if (tasks.length > LARGE_PROJECT_TASK_COUNT) {
    console.warn(
      `[Timeline] GET /timeline: project ${req.project._id} has ${tasks.length} tasks — fetch may be slow`,
    );
  }

  const tasksWithKey = withTaskKey(tasks, req.project.keyPrefix);

  return res
    .status(200)
    .json(new ApiResponses(200, { tasks: tasksWithKey }, "Timeline tasks fetched"));
});

// ─── POST /tasks/:projectId ───────────────────────────────────────────────────
export const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status, startDate, dueDate } = req.body;

  if (assignedTo) {
    const isMember = req.project.members.some(
      (m) => m.user.toString() === assignedTo,
    );
    if (!isMember) {
      throw new ApiError(400, "Assigned user is not a member of this project");
    }
  }

  // Atomic allocation — never `count() + 1` (same race-condition class as the
  // Kanban ordering bug; this one would corrupt identity, not just ordering).
  // req.project is a snapshot from attachProject; re-read taskCounter via the
  // $inc's returned document, not req.project, since a concurrent request may
  // have already bumped it.
  const projectWithNextNumber = await Project.findOneAndUpdate(
    { _id: req.project._id },
    { $inc: { taskCounter: 1 } },
    { new: true, projection: { taskCounter: 1, keyPrefix: 1 } },
  );

  let task;
  try {
    task = await Task.create({
      title,
      description,
      project: req.project._id,
      taskNumber: projectWithNextNumber.taskCounter,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      status: status || TaskStatusEnum.TODO,
      startDate: startDate || null,
      dueDate: dueDate || null,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      throw new ApiError(400, err.message);
    }
    throw err;
  }

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "username fullName avatar")
    .populate("createdBy", "username fullName avatar")
    .populate("project", "keyPrefix");

  log(req.project._id, req.user._id, "created_task", title);

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
    .populate("project", "keyPrefix")
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
export const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assignedTo, status } = req.body;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // ── Authorization ─────────────────────────────────────────────────────────
  // Managers (project_admin/admin) may edit any field. The task's assignee may
  // change status ONLY. No one else may modify the task. This keeps task
  // creation/assignment manager-only while letting members work their queue.
  const membership = req.project.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );
  const isManager =
    membership?.role === ProjectRolesEnum.PROJECT_ADMIN ||
    membership?.role === ProjectRolesEnum.ADMIN;
  const isAssignee =
    task.assignedTo && task.assignedTo.toString() === req.user._id.toString();

  if (!isManager) {
    if (!isAssignee) {
      throw new ApiError(403, "You are not allowed to update this task");
    }
    if (
      title !== undefined ||
      description !== undefined ||
      assignedTo !== undefined
    ) {
      throw new ApiError(
        403,
        "You can only change the status of your assigned task",
      );
    }
    if (status === undefined) {
      throw new ApiError(400, "No status provided");
    }
  }

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

  // Log status change as a move event; other field edits as a plain update
  if (status !== undefined && status !== task.status) {
    log(req.project._id, req.user._id, "moved_task", task.title, {
      from: task.status,
      to: status,
    });
  } else if (Object.keys(updates).length > 0) {
    log(req.project._id, req.user._id, "updated_task", task.title);
  }

  return res
    .status(200)
    .json(new ApiResponses(200, { task: updatedTask }, "Task updated"));
});

// ─── PATCH /tasks/:projectId/t/:taskId/schedule ───────────────────────────────
// Manager-only (checkProjectRole at the route). Route-level express-validator
// rejects malformed date strings before this runs; the dueDate>=startDate
// business rule lives in the Mongoose schema validator and is caught here.
export const updateTaskSchedule = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { startDate, dueDate } = req.body;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const from = { startDate: task.startDate, dueDate: task.dueDate };

  // Mutate + .save() rather than findByIdAndUpdate: the dueDate>=startDate
  // validator reads a sibling field via `this.startDate`, which only has
  // access to the full document during .save() — a findByIdAndUpdate() with
  // a partial $set only exposes the fields being updated to the validator,
  // so an update that touches dueDate alone would silently skip checking it
  // against the unmodified startDate already on the document.
  if (startDate !== undefined) task.startDate = startDate;
  if (dueDate !== undefined) task.dueDate = dueDate;

  try {
    await task.save();
  } catch (err) {
    if (err.name === "ValidationError") {
      throw new ApiError(400, err.message);
    }
    throw err;
  }

  const updatedTask = await task.populate(
    "assignedTo createdBy",
    "username fullName avatar",
  );

  log(req.project._id, req.user._id, "rescheduled_task", task.title, {
    from,
    to: { startDate: updatedTask.startDate, dueDate: updatedTask.dueDate },
  });

  return res
    .status(200)
    .json(new ApiResponses(200, { task: updatedTask }, "Task rescheduled"));
});

// ─── PATCH /tasks/:projectId/t/:taskId/dependencies ───────────────────────────
// Manager-only. Client submits the FULL desired dependsOn array (replace
// semantics) — the controller diffs against the current array to find what
// was actually added/removed, since only newly-added edges need a cycle
// check and each add/remove gets its own Activity log entry.
//
//   fetch task + project's full task set (1 query each)
//     -> diff added/removed dependency ids
//     -> validate added targets: same project, not self
//     -> cycle-check each added edge (in-memory walk, no per-hop query)
//     -> save with __v version guard; on conflict, refetch + recheck once
//     -> log one Activity entry per added/removed link
export const updateTaskDependencies = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const newIds = [...new Set((req.body.dependsOn || []).map(String))];

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const currentIds = task.dependsOn.map((id) => id.toString());
  const addedIds = newIds.filter((id) => !currentIds.includes(id));
  const removedIds = currentIds.filter((id) => !newIds.includes(id));

  if (addedIds.length === 0 && removedIds.length === 0) {
    const unchanged = await Task.findById(taskId).populate(
      "assignedTo createdBy",
      "username fullName avatar",
    );
    return res
      .status(200)
      .json(new ApiResponses(200, { task: unchanged }, "No dependency changes"));
  }

  if (addedIds.includes(taskId)) {
    throw new ApiError(400, "A task cannot depend on itself");
  }

  const addedTargets = addedIds.length
    ? await Task.find({ _id: { $in: addedIds } })
        .select("_id project title")
        .lean()
    : [];
  if (addedTargets.length !== addedIds.length) {
    throw new ApiError(404, "One or more dependency targets not found");
  }
  const crossProjectTarget = addedTargets.find(
    (t) => t.project.toString() !== req.project._id.toString(),
  );
  if (crossProjectTarget) {
    throw new ApiError(400, "Dependency must be in the same project");
  }

  const checkForCycles = async () => {
    const projectTasks = await Task.find({ project: req.project._id })
      .select("_id dependsOn")
      .lean();
    if (projectTasks.length > LARGE_PROJECT_TASK_COUNT) {
      console.warn(
        `[Timeline] PATCH /dependencies: project ${req.project._id} has ${projectTasks.length} tasks — cycle check may be slow`,
      );
    }
    for (const newDependsOnId of addedIds) {
      if (wouldCreateCycle(projectTasks, taskId, newDependsOnId)) {
        throw new ApiError(409, "This would create a circular dependency");
      }
    }
  };

  await checkForCycles();

  // Optimistic concurrency: only save if the document's version hasn't
  // changed since we read it. findOneAndUpdate doesn't auto-bump __v the way
  // .save() does, so the write itself increments it — that's what makes the
  // NEXT concurrent writer's __v match fail instead of both writes silently
  // succeeding and producing an actual cycle (e.g. two managers linking
  // A→B and B→A at once).
  let updatedTask = await Task.findOneAndUpdate(
    { _id: taskId, __v: task.__v },
    { $set: { dependsOn: newIds }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );

  if (!updatedTask) {
    const fresh = await Task.findOne({ _id: taskId, project: req.project._id });
    if (!fresh) {
      throw new ApiError(404, "Task not found");
    }
    await checkForCycles();
    updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, __v: fresh.__v },
      { $set: { dependsOn: newIds }, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
    if (!updatedTask) {
      throw new ApiError(409, "Task was modified concurrently, please retry");
    }
  }

  // dependsOn must be populated here too — the frontend's dependency-line
  // rendering reads dep.title/dep._id off each entry, same shape GET
  // /timeline returns. Without this, a successful PATCH response would hand
  // back raw ObjectIds and silently break the client's dependency lookups.
  updatedTask = await updatedTask.populate([
    { path: "assignedTo createdBy", select: "username fullName avatar" },
    { path: "dependsOn", select: "title" },
  ]);

  const removedTargets = removedIds.length
    ? await Task.find({ _id: { $in: removedIds } })
        .select("title")
        .lean()
    : [];
  const titleById = new Map(
    [...addedTargets, ...removedTargets].map((t) => [t._id.toString(), t.title]),
  );

  addedIds.forEach((id) =>
    log(req.project._id, req.user._id, "linked_dependency", task.title, {
      dependsOnTitle: titleById.get(id),
    }),
  );
  removedIds.forEach((id) =>
    log(req.project._id, req.user._id, "unlinked_dependency", task.title, {
      dependsOnTitle: titleById.get(id),
    }),
  );

  return res
    .status(200)
    .json(new ApiResponses(200, { task: updatedTask }, "Dependencies updated"));
});

// ─── DELETE /tasks/:projectId/t/:taskId ───────────────────────────────────────
export const deleteTask = asyncHandler(async (req, res) => {
  const { taskId, projectId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  await SubTask.deleteMany({ task: taskId });

  // Scrub dangling dependsOn refs — any task in this project that depended on
  // the one being deleted must not be left pointing at a ghost ID.
  await Task.updateMany(
    { project: req.project._id, dependsOn: taskId },
    { $pull: { dependsOn: taskId } },
  );

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

  log(req.project._id, req.user._id, "deleted_task", task.title);

  return res
    .status(200)
    .json(
      new ApiResponses(200, {}, "Task and its subtasks deleted successfully"),
    );
});

// ─── POST /tasks/:projectId/t/:taskId/subtasks ────────────────────────────────
export const createSubTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, assignedTo } = req.body;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

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

  log(req.project._id, req.user._id, "created_subtask", title, {
    taskTitle: task.title,
  });

  return res
    .status(201)
    .json(new ApiResponses(201, { subTask: populated }, "Subtask created"));
});

// ─── PUT /tasks/:projectId/st/:subTaskId ──────────────────────────────────────
export const updateSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;
  const { title, isCompleted, assignedTo } = req.body;

  const subTask = await SubTask.findById(subTaskId).populate(
    "task",
    "project title",
  );
  if (
    !subTask ||
    subTask.task.project.toString() !== req.project._id.toString()
  ) {
    throw new ApiError(404, "Subtask not found");
  }

  const isMemberRole = req.projectRole === ProjectRolesEnum.MEMBER;

  if (isMemberRole && (title !== undefined || assignedTo !== undefined)) {
    throw new ApiError(
      403,
      "Members can only update subtask completion status",
    );
  }

  const updates = {};
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;

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

  // Log completion toggle specifically
  if (isCompleted === true && subTask.isCompleted === false) {
    log(req.project._id, req.user._id, "completed_subtask", subTask.title, {
      taskTitle: subTask.task.title,
    });
  } else if (isCompleted === false && subTask.isCompleted === true) {
    log(req.project._id, req.user._id, "uncompleted_subtask", subTask.title, {
      taskTitle: subTask.task.title,
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponses(200, { subTask: updatedSubTask }, "Subtask updated"),
    );
});

// ─── DELETE /tasks/:projectId/st/:subTaskId ───────────────────────────────────
export const deleteSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;

  const subTask = await SubTask.findById(subTaskId).populate(
    "task",
    "project title",
  );
  if (
    !subTask ||
    subTask.task.project.toString() !== req.project._id.toString()
  ) {
    throw new ApiError(404, "Subtask not found");
  }

  await SubTask.findByIdAndDelete(subTaskId);

  log(req.project._id, req.user._id, "deleted_subtask", subTask.title, {
    taskTitle: subTask.task.title,
  });

  return res.status(200).json(new ApiResponses(200, {}, "Subtask deleted"));
});

// ─── POST /tasks/:projectId/t/:taskId/attachments ─────────────────────────────
export const addTaskAttachments = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "No files were uploaded");
  }

  const totalAfterUpload = task.attachments.length + req.files.length;
  if (totalAfterUpload > 5) {
    req.files.forEach((f) => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    throw new ApiError(
      400,
      `This task already has ${task.attachments.length} attachment(s). Maximum is 5.`,
    );
  }

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
export const deleteTaskAttachment = asyncHandler(async (req, res) => {
  const { taskId, attachmentId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const attachment = task.attachments.id(attachmentId);
  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

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
