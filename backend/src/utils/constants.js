// ─── User Roles ───────────────────────────────────────────────────────────────

export const UserRolesEnum = {
  ADMIN: "admin",
  PROJECT_ADMIN: "project_admin",
  MEMBER: "member",
};

export const AvailableUserRole = Object.values(UserRolesEnum);

// Role hierarchy — higher index = more permissions.
// Used by checkProjectRole middleware to compare minimum required vs actual.
export const RoleHierarchy = {
  [UserRolesEnum.MEMBER]: 0,
  [UserRolesEnum.PROJECT_ADMIN]: 1,
  [UserRolesEnum.ADMIN]: 2,
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
