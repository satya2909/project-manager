import multer from "multer";
import { ApiError } from "../utils/api-error.js";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_TASK,
  SPREADSHEET_MIME_TYPES,
  MAX_INVITE_SHEET_BYTES,
} from "../utils/constants.js";

// ─── Storage Engine ───────────────────────────────────────────────────────────
// In-memory — task attachments are uploaded straight through to Cloudflare R2
// (backend/src/services/object-storage.js) rather than written to local disk.
// Render web services have no persistent disk by default, so diskStorage
// silently lost every attachment on a deploy/restart (plans/TODOS.md's
// re-audited deployment blocker). Same pattern the bulk-invite sheet upload
// below already used.

const storage = multer.memoryStorage();

// ─── File Filter ──────────────────────────────────────────────────────────────
const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        415,
        `File type '${file.mimetype}' is not allowed. Accepted: images, PDF, Word, Excel, CSV, plain text.`,
      ),
      false,
    );
  }
};

// ─── Multer Instance ──────────────────────────────────────────────────────────
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 10 MB per file
    files: MAX_FILES_PER_TASK, // max 5 files per request
  },
});

// Named middleware — field name "attachments" must match the frontend FormData key
export const uploadTaskFiles = upload.array("attachments", MAX_FILES_PER_TASK);

// ─── Bulk-Invite Sheet Upload ─────────────────────────────────────────────────
// A single spreadsheet, held in memory (never written to disk) so it can be
// streamed straight into the exceljs parser and then GC'd. Restricted to
// spreadsheet MIME types with a tight size cap of its own.

const spreadsheetFilter = (_req, file, cb) => {
  if (SPREADSHEET_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        415,
        `File type '${file.mimetype}' is not allowed. Upload an Excel (.xlsx) or CSV file.`,
      ),
      false,
    );
  }
};

const inviteSheetUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: spreadsheetFilter,
  limits: {
    fileSize: MAX_INVITE_SHEET_BYTES,
    files: 1,
  },
});

// Field name "file" must match the frontend FormData key.
export const uploadInviteSheet = inviteSheetUpload.single("file");
