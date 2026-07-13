import { Project } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { OrgRolesEnum } from "../utils/constants.js";

// ─── attachProject ────────────────────────────────────────────────────────────
// Fetches the project by :projectId and attaches it to req.project.
// Must run AFTER verifyJWT and BEFORE checkProjectRole.
//
// Access ladder (order matters):
//   400  no projectId
//   404  project does not exist
//   404  project belongs to a DIFFERENT org — indistinguishable from "does not
//        exist" on purpose, so the status code never confirms a cross-org
//        project's existence
//   403  project is in the caller's org but they are not a member
//        (exists-but-no-access is a deliberate, same-org-only distinction)

export const attachProject = asyncHandler(async (req, _res, next) => {
  const { projectId } = req.params;

  if (!projectId) {
    throw new ApiError(400, "Project ID is required");
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Org boundary. Guards are fail-closed because `organization` is not yet
  // enforced (required) on User/Project — an org-less user (e.g. a fresh signup
  // before registration is org-aware) or legacy project must be denied, never
  // crash on `undefined.toString()`.
  if (!req.user.organization) {
    throw new ApiError(401, "Your account is not associated with an organization");
  }

  if (
    !project.organization ||
    project.organization.toString() !== req.user.organization.toString()
  ) {
    throw new ApiError(404, "Project not found");
  }

  // Org owner/admin can access ANY project in their org (they've already
  // cleared the org boundary above), even if not listed in project.members.
  // Regular members must be on the project.
  const isOrgManager =
    req.user.role === OrgRolesEnum.OWNER || req.user.role === OrgRolesEnum.ADMIN;
  const isMember = project.members.some(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!isMember && !isOrgManager) {
    throw new ApiError(403, "You do not have access to this project");
  }

  req.project = project;
  next();
});
