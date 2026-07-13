// ─── Organization Roles ───────────────────────────────────────────────────────
// Org-level roles (User.role, Invite.role). One owner per org holds billing /
// deletion rights; admin handles day-to-day management; member is the default.

export const OrgRolesEnum = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
};

export const AvailableOrgRole = Object.values(OrgRolesEnum);

// Org role hierarchy — higher index = more permissions.
// Used by checkOrgRole middleware to compare minimum required vs actual.
export const OrgRoleHierarchy = {
  [OrgRolesEnum.MEMBER]: 0,
  [OrgRolesEnum.ADMIN]: 1,
  [OrgRolesEnum.OWNER]: 2,
};

// ─── Project Roles ────────────────────────────────────────────────────────────
// Project-scoped roles (Project.members[].role). Distinct from org roles above.
// These two scopes previously shared one enum, which caused naming collisions
// (e.g. the isAdmin ambiguity) — they are now separated.

export const ProjectRolesEnum = {
  ADMIN: "admin",
  PROJECT_ADMIN: "project_admin",
  MEMBER: "member",
};

export const AvailableProjectRole = Object.values(ProjectRolesEnum);

// Project role hierarchy — higher index = more permissions.
// Used by checkProjectRole middleware to compare minimum required vs actual.
export const ProjectRoleHierarchy = {
  [ProjectRolesEnum.MEMBER]: 0,
  [ProjectRolesEnum.PROJECT_ADMIN]: 1,
  [ProjectRolesEnum.ADMIN]: 2,
};

// ─── Task Status ──────────────────────────────────────────────────────────────

export const TaskStatusEnum = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  DONE: "done",
};

export const AvailableTaskStatus = Object.values(TaskStatusEnum);

// ─── Cookie Options ───────────────────────────────────────────────────────────
// Shared cookie config for access + refresh tokens.
// httpOnly prevents JS access (XSS protection).
// secure is true only in production (requires HTTPS).

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

// ─── File Upload ──────────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_TASK = 5;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
