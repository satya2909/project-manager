import { Project } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

// ─── attachProject ────────────────────────────────────────────────────────────
// Fetches the project by :projectId and attaches it to req.project.
// Must run AFTER verifyJWT and BEFORE checkProjectRole.
//
// Non-members get 403, not 404 — avoids leaking whether a project exists.

export const attachProject = asyncHandler(async (req, _res, next) => {
  const { projectId } = req.params;

  if (!projectId) {
    throw new ApiError(400, "Project ID is required");
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const isMember = project.members.some(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!isMember) {
    throw new ApiError(403, "You do not have access to this project");
  }

  req.project = project;
  next();
});
