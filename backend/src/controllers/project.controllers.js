import { Project, User } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import { UserRolesEnum, RoleHierarchy } from "../utils/constants.js";
import { sendProjectInviteEmail } from "../utils/mail.js";

// ─── POST /projects ───────────────────────────────────────────────────────────
// Create a new project. Creator is auto-added as admin.
export const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await Project.create({
    name,
    description,
    createdBy: req.user._id,
    members: [{ user: req.user._id, role: UserRolesEnum.ADMIN }],
  });

  return res
    .status(201)
    .json(new ApiResponses(201, { project }, "Project created successfully"));
});

// ─── GET /projects ────────────────────────────────────────────────────────────
// List all projects the requesting user belongs to.
export const getUserProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({ "members.user": req.user._id })
    .populate("createdBy", "username fullName avatar")
    .sort({ createdAt: -1 })
    .lean();

  const projectsWithRole = projects.map((p) => {
    const membership = p.members.find(
      (m) => m.user.toString() === req.user._id.toString(),
    );
    return {
      ...p,
      memberCount: p.members.length,
      myRole: membership?.role ?? UserRolesEnum.MEMBER,
    };
  });

  return res
    .status(200)
    .json(
      new ApiResponses(200, { projects: projectsWithRole }, "Projects fetched"),
    );
});

// ─── GET /projects/:projectId ─────────────────────────────────────────────────
export const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.project._id)
    .populate("createdBy", "username fullName avatar")
    .populate("members.user", "username fullName avatar email")
    .lean();

  return res
    .status(200)
    .json(new ApiResponses(200, { project }, "Project fetched"));
});

// ─── PUT /projects/:projectId ─────────────────────────────────────────────────
// Admin only — enforced by route middleware chain.
export const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const updatedProject = await Project.findByIdAndUpdate(
    req.project._id,
    { $set: { name, description } },
    { new: true, runValidators: true },
  );

  return res
    .status(200)
    .json(
      new ApiResponses(200, { project: updatedProject }, "Project updated"),
    );
});

// ─── DELETE /projects/:projectId ──────────────────────────────────────────────
// Admin only.
export const deleteProject = asyncHandler(async (req, res) => {
  await Project.findByIdAndDelete(req.project._id);

  // Cascade deletes (tasks, subtasks, notes) will be added in Phase 4
  // after all models are wired. Stubbed here for clarity.

  return res
    .status(200)
    .json(new ApiResponses(200, {}, "Project deleted successfully"));
});

// ─── GET /projects/:projectId/members ─────────────────────────────────────────
export const getProjectMembers = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.project._id)
    .populate("members.user", "username fullName avatar email isEmailVerified")
    .lean();

  return res
    .status(200)
    .json(
      new ApiResponses(200, { members: project.members }, "Members fetched"),
    );
});

// ─── POST /projects/:projectId/members ────────────────────────────────────────
// Admin only. Looks up user by email, adds them, sends invite email.
export const addProjectMember = asyncHandler(async (req, res) => {
  const { email, role = UserRolesEnum.MEMBER } = req.body;

  if (!Object.values(UserRolesEnum).includes(role)) {
    throw new ApiError(
      400,
      `Invalid role. Valid values: ${Object.values(UserRolesEnum).join(", ")}`,
    );
  }

  const userToAdd = await User.findOne({ email });
  if (!userToAdd) {
    throw new ApiError(404, `No account found with email: ${email}`);
  }

  const isAlreadyMember = req.project.members.some(
    (m) => m.user.toString() === userToAdd._id.toString(),
  );
  if (isAlreadyMember) {
    throw new ApiError(409, "This user is already a member of the project");
  }

  const updatedProject = await Project.findByIdAndUpdate(
    req.project._id,
    { $push: { members: { user: userToAdd._id, role } } },
    { new: true },
  ).populate("members.user", "username fullName avatar email");

  await sendProjectInviteEmail(
    userToAdd.email,
    userToAdd.username,
    req.project.name,
    req.user.username,
  );

  return res
    .status(200)
    .json(
      new ApiResponses(
        200,
        { project: updatedProject },
        `${userToAdd.username} added to project`,
      ),
    );
});

// ─── PUT /projects/:projectId/members/:userId ──────────────────────────────────
// Admin only. Cannot self-demote or assign role higher than own.
export const updateMemberRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!Object.values(UserRolesEnum).includes(role)) {
    throw new ApiError(
      400,
      `Invalid role. Valid values: ${Object.values(UserRolesEnum).join(", ")}`,
    );
  }

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot change your own role");
  }

  const targetMembership = req.project.members.find(
    (m) => m.user.toString() === userId,
  );
  if (!targetMembership) {
    throw new ApiError(404, "User is not a member of this project");
  }

  // Prevent privilege escalation — cannot assign a role higher than your own
  if (RoleHierarchy[role] > RoleHierarchy[req.projectRole]) {
    throw new ApiError(403, "You cannot assign a role higher than your own");
  }

  const updatedProject = await Project.findOneAndUpdate(
    { _id: req.project._id, "members.user": userId },
    { $set: { "members.$.role": role } },
    { new: true },
  ).populate("members.user", "username fullName avatar email");

  return res
    .status(200)
    .json(
      new ApiResponses(200, { project: updatedProject }, "Member role updated"),
    );
});

// ─── DELETE /projects/:projectId/members/:userId ───────────────────────────────
// Admin only. Cannot remove yourself.
export const removeProjectMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot remove yourself from the project");
  }

  const isMember = req.project.members.some(
    (m) => m.user.toString() === userId,
  );
  if (!isMember) {
    throw new ApiError(404, "User is not a member of this project");
  }

  const updatedProject = await Project.findByIdAndUpdate(
    req.project._id,
    { $pull: { members: { user: userId } } },
    { new: true },
  ).populate("members.user", "username fullName avatar email");

  return res
    .status(200)
    .json(new ApiResponses(200, { project: updatedProject }, "Member removed"));
});
