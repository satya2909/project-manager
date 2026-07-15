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
// sameSite: "none" in production because the frontend (Vercel) and backend
// (Render) are deployed on different origins — a cross-site cookie needs
// SameSite=None, which browsers only honor when Secure is also set (true
// above whenever this applies). "strict" is fine in dev, where the Vite
// proxy makes requests same-origin.

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
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

// ─── Bulk Invite Upload ───────────────────────────────────────────────────────
// Spreadsheet MIME types accepted for the bulk-invite upload. Kept separate from
// ALLOWED_MIME_TYPES (task attachments) so the invite endpoint only takes sheets.
export const SPREADSHEET_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv (exceljs can read it too)
  "application/csv",
  "text/plain", // some browsers label .csv as text/plain
];

// Hard cap on rows per bulk-invite upload. Bounds memory, SMTP fan-out, and
// domain-reputation blast radius; keeps the request synchronous and fast.
export const MAX_BULK_INVITE_ROWS = 200;

// Max size for an uploaded invite sheet (2 MB — a 200-row sheet is a few KB).
export const MAX_INVITE_SHEET_BYTES = 2 * 1024 * 1024;

// How many invite emails to dispatch concurrently. Throttled so a big upload
// doesn't hammer the SMTP provider or blow past its rate limit.
export const INVITE_EMAIL_CONCURRENCY = 5;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
