import { Project, User, Activity } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponses } from "../utils/api-responses.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  ProjectRolesEnum,
  ProjectRoleHierarchy,
  AvailableProjectRole,
  OrgRolesEnum,
} from "../utils/constants.js";
import { sendProjectInviteEmail } from "../utils/mail.js";

// ─── helper ───────────────────────────────────────────────────────────────────
const log = (projectId, userId, action, target = "", metadata = {}) => {
  Activity.create({
    project: projectId,
    user: userId,
    action,
    target,
    metadata,
  }).catch((e) => console.error("[Activity]", e.message));
};

// ─── helper — task-key prefix ──────────────────────────────────────────────────
// Prefix is "chosen, not derived" in the product (plans/PRD_v2.md §6.1) — the
// create-project modal always sends an explicit, user-edited value. This
// fallback exists for direct API/script callers only, so the endpoint never
// 500s on a missing field; it does not replace the UI's explicit-choice flow.
function deriveKeyPrefix(name) {
  const letters = (name || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  const base = letters.slice(0, 4) || "PROJ";
  return base.length < 2 ? base.padEnd(2, "X") : base;
}

// Uniqueness spans keyPrefix ∪ prefixAliases, scoped to the org — Mongo can't
// express "unique across a scalar ∪ an array" as one index, so the
// authoritative check lives here (the DB indexes in project.models.js are a
// second line of defense, not the sole enforcement). `excludeProjectId` lets
// a rename check against every OTHER project's prefixes without excluding
// itself from... itself (a project keeping its own current prefix isn't a
// collision).
async function assertPrefixAvailable(organizationId, prefix, { excludeProjectId } = {}) {
  const query = {
    organization: organizationId,
    $or: [{ keyPrefix: prefix }, { prefixAliases: prefix }],
  };
  if (excludeProjectId) {
    query._id = { $ne: excludeProjectId };
  }
  const collision = await Project.findOne(query).select("_id").lean();
  if (collision) {
    throw new ApiError(
      409,
      `Key prefix "${prefix}" is already in use in your organization`,
    );
  }
}

// ─── POST /projects ───────────────────────────────────────────────────────────
export const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const keyPrefix = (req.body.keyPrefix || deriveKeyPrefix(name)).toUpperCase();

  await assertPrefixAvailable(req.user.organization, keyPrefix);

  let project;
  try {
    project = await Project.create({
      name,
      description,
      keyPrefix,
      organization: req.user.organization,
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: ProjectRolesEnum.ADMIN }],
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      throw new ApiError(400, err.message);
    }
    if (err.code === 11000) {
      throw new ApiError(409, "Key prefix is already in use in your organization");
    }
    throw err;
  }

  return res
    .status(201)
    .json(new ApiResponses(201, { project }, "Project created successfully"));
});

// ─── GET /projects ────────────────────────────────────────────────────────────
export const getUserProjects = asyncHandler(async (req, res) => {
  // Org owner/admin see every project in their org; members see only the
  // projects they're personally on (still scoped to their org).
  const isOrgManager =
    req.user.role === OrgRolesEnum.OWNER || req.user.role === OrgRolesEnum.ADMIN;

  const query = isOrgManager
    ? { organization: req.user.organization }
    : { organization: req.user.organization, "members.user": req.user._id };

  const projects = await Project.find(query)
    .populate("createdBy", "username fullName avatar")
    .sort({ createdAt: -1 })
    .lean();

  const projectsWithRole = projects.map((p) => {
    const membership = p.members.find(
      (m) => m.user.toString() === req.user._id.toString(),
    );
    // Org managers act as project-admin even on projects they're not listed on.
    const fallbackRole = isOrgManager
      ? ProjectRolesEnum.ADMIN
      : ProjectRolesEnum.MEMBER;
    return {
      ...p,
      memberCount: p.members.length,
      myRole: membership?.role ?? fallbackRole,
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
export const updateProject = asyncHandler(async (req, res) => {
  const { name, description, keyPrefix } = req.body;

  const update = { $set: {} };
  if (name !== undefined) update.$set.name = name;
  if (description !== undefined) update.$set.description = description;

  if (keyPrefix !== undefined) {
    const nextPrefix = keyPrefix.toUpperCase();
    if (nextPrefix !== req.project.keyPrefix) {
      // Prefixes are never reassignable (plans/PRD_v2.md §6.1) — uniqueness
      // spans keyPrefix ∪ prefixAliases, so this also rejects reusing a
      // prefix this same project retired earlier via a prior rename.
      await assertPrefixAvailable(req.user.organization, nextPrefix, {
        excludeProjectId: req.project._id,
      });
      update.$set.keyPrefix = nextPrefix;
      // The old prefix becomes an alias so in-flight branches/PRs referencing
      // it still parse (plans/PRD_v2.md §6.1) — one write, one document, zero
      // task updates, since taskKey is computed, not stored.
      update.$addToSet = { prefixAliases: req.project.keyPrefix };
    }
  }

  const updatedProject = await Project.findByIdAndUpdate(req.project._id, update, {
    new: true,
    runValidators: true,
  });

  return res
    .status(200)
    .json(
      new ApiResponses(200, { project: updatedProject }, "Project updated"),
    );
});

// ─── DELETE /projects/:projectId ──────────────────────────────────────────────
export const deleteProject = asyncHandler(async (req, res) => {
  await Project.findByIdAndDelete(req.project._id);

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
export const addProjectMember = asyncHandler(async (req, res) => {
  const { email, role = ProjectRolesEnum.MEMBER } = req.body;

  if (!AvailableProjectRole.includes(role)) {
    throw new ApiError(
      400,
      `Invalid role. Valid values: ${AvailableProjectRole.join(", ")}`,
    );
  }

  // Only members of the caller's own org can be added — never a cross-org
  // lookup. Project membership does not create accounts; org invites do that.
  const userToAdd = await User.findOne({
    email,
    organization: req.user.organization,
    status: "active",
  });
  if (!userToAdd) {
    throw new ApiError(
      404,
      `No active member of your organization found with email: ${email}. Invite them to the organization first.`,
    );
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

  log(
    req.project._id,
    req.user._id,
    "added_member",
    userToAdd.username || userToAdd.email,
    { role },
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
export const updateMemberRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!AvailableProjectRole.includes(role)) {
    throw new ApiError(
      400,
      `Invalid role. Valid values: ${AvailableProjectRole.join(", ")}`,
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

  if (ProjectRoleHierarchy[role] > ProjectRoleHierarchy[req.projectRole]) {
    throw new ApiError(403, "You cannot assign a role higher than your own");
  }

  const targetUser = await User.findById(userId).select("username");

  const updatedProject = await Project.findOneAndUpdate(
    { _id: req.project._id, "members.user": userId },
    { $set: { "members.$.role": role } },
    { new: true },
  ).populate("members.user", "username fullName avatar email");

  log(
    req.project._id,
    req.user._id,
    "updated_role",
    targetUser?.username || userId,
    { from: targetMembership.role, to: role },
  );

  return res
    .status(200)
    .json(
      new ApiResponses(200, { project: updatedProject }, "Member role updated"),
    );
});

// ─── DELETE /projects/:projectId/members/:userId ───────────────────────────────
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

  const targetUser = await User.findById(userId).select("username");

  const updatedProject = await Project.findByIdAndUpdate(
    req.project._id,
    { $pull: { members: { user: userId } } },
    { new: true },
  ).populate("members.user", "username fullName avatar email");

  log(
    req.project._id,
    req.user._id,
    "removed_member",
    targetUser?.username || userId,
  );

  return res
    .status(200)
    .json(new ApiResponses(200, { project: updatedProject }, "Member removed"));
});
