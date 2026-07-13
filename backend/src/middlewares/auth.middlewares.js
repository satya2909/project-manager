import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

// ─── verifyJWT ────────────────────────────────────────────────────────────────
// Extracts the access token from either:
//   1. Authorization header: "Bearer <token>"
//   2. Cookie: accessToken=<token>  (set during login)
//
// On success:  attaches the full User document to req.user and calls next()
// On failure:  throws 401 ApiError — caught by the global error handler

export const verifyJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized: no access token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token has expired");
    }
    throw new ApiError(401, "Invalid access token");
  }

  // Fetch user — exclude sensitive fields.
  // NOTE: this is a NEGATIVE projection on purpose — it must keep `organization`
  // and `role`, which every downstream middleware depends on (attachProject's
  // org boundary + checkOrgRole/checkProjectRole). Do not switch to a positive
  // projection without explicitly re-including both.
  const user = await User.findById(decoded._id).select(
    "-password -refreshToken -emailVerificationToken -forgotPasswordToken",
  );

  if (!user) {
    throw new ApiError(401, "User not found — token may be stale");
  }

  if (user.status === "deactivated") {
    throw new ApiError(401, "Your account has been deactivated");
  }

  req.user = user;
  next();
});

// ─── checkProjectRole ─────────────────────────────────────────────────────────
// Used on project-scoped routes. Checks the requesting user's role within
// the specific project (from project.members[]) against a minimum required role.
//
// Must be used AFTER verifyJWT and after req.project is populated.
// The project controller attaches req.project before calling this middleware.
//
// Usage:  router.put("/:projectId", verifyJWT, attachProject, checkProjectRole("admin"), ...)
//
// ProjectRoleHierarchy: member(0) < project_admin(1) < admin(2)

import {
  ProjectRoleHierarchy,
  OrgRoleHierarchy,
  OrgRolesEnum,
  ProjectRolesEnum,
} from "../utils/constants.js";

export const checkProjectRole = (minimumRole) => {
  return asyncHandler(async (req, _, next) => {
    const project = req.project;

    if (!project) {
      throw new ApiError(
        500,
        "checkProjectRole used without req.project — attach the project first",
      );
    }

    // Org owner/admin act as effective project-admin on any project in their
    // org — they manage the whole org, so no per-project membership is required.
    const isOrgManager =
      req.user.role === OrgRolesEnum.OWNER ||
      req.user.role === OrgRolesEnum.ADMIN;
    if (isOrgManager) {
      req.projectRole = ProjectRolesEnum.ADMIN;
      return next();
    }

    // Find this user's membership entry in the project
    const membership = project.members.find(
      (m) => m.user.toString() === req.user._id.toString(),
    );

    if (!membership) {
      throw new ApiError(403, "You are not a member of this project");
    }

    const userLevel = ProjectRoleHierarchy[membership.role] ?? -1;
    const requiredLevel = ProjectRoleHierarchy[minimumRole] ?? 99;

    if (userLevel < requiredLevel) {
      throw new ApiError(
        403,
        `This action requires the '${minimumRole}' role or higher`,
      );
    }

    // Attach role to req so controllers don't re-query
    req.projectRole = membership.role;
    next();
  });
};

// ─── checkOrgRole ─────────────────────────────────────────────────────────────
// Used on routes that are NOT scoped to an existing project (e.g. creating a
// new project). Checks the user's ORG-level role (req.user.role) against a
// minimum required role. Must be used AFTER verifyJWT.
//
// OrgRoleHierarchy: member(0) < admin(1) < owner(2)

export const checkOrgRole = (minimumRole) => {
  return asyncHandler(async (req, _, next) => {
    const userLevel = OrgRoleHierarchy[req.user?.role] ?? -1;
    const requiredLevel = OrgRoleHierarchy[minimumRole] ?? 99;

    if (userLevel < requiredLevel) {
      throw new ApiError(
        403,
        `This action requires the '${minimumRole}' role or higher`,
      );
    }

    next();
  });
};
