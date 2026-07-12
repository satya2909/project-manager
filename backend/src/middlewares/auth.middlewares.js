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

  // Fetch user — exclude sensitive fields
  const user = await User.findById(decoded._id).select(
    "-password -refreshToken -emailVerificationToken -forgotPasswordToken",
  );

  if (!user) {
    throw new ApiError(401, "User not found — token may be stale");
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
// RoleHierarchy: member(0) < project_admin(1) < admin(2)

import { RoleHierarchy, UserRolesEnum } from "../utils/constants.js";

export const checkProjectRole = (minimumRole) => {
  return asyncHandler(async (req, _, next) => {
    const project = req.project;

    if (!project) {
      throw new ApiError(
        500,
        "checkProjectRole used without req.project — attach the project first",
      );
    }

    // Find this user's membership entry in the project
    const membership = project.members.find(
      (m) => m.user.toString() === req.user._id.toString(),
    );

    if (!membership) {
      throw new ApiError(403, "You are not a member of this project");
    }

    const userLevel = RoleHierarchy[membership.role] ?? -1;
    const requiredLevel = RoleHierarchy[minimumRole] ?? 99;

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

// ─── checkGlobalRole ──────────────────────────────────────────────────────────
// Used on routes that are NOT scoped to an existing project (e.g. creating a
// new project). Checks the user's GLOBAL account role (req.user.role) against a
// minimum required role. Must be used AFTER verifyJWT.
//
// RoleHierarchy: member(0) < project_admin(1) < admin(2)

export const checkGlobalRole = (minimumRole) => {
  return asyncHandler(async (req, _, next) => {
    const userLevel = RoleHierarchy[req.user?.role] ?? -1;
    const requiredLevel = RoleHierarchy[minimumRole] ?? 99;

    if (userLevel < requiredLevel) {
      throw new ApiError(
        403,
        `This action requires the '${minimumRole}' role or higher`,
      );
    }

    next();
  });
};
