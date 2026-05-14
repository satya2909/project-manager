import multer from "multer";
import path from "path";
import fs from "fs";
import { ApiError } from "../utils/api-error.js";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_TASK,
} from "../utils/constants.js";

// ─── Storage Engine ───────────────────────────────────────────────────────────
// Files land at: public/images/<projectId>/<taskId>/<sanitised-filename>
// projectId and taskId are available from req.params at upload time.

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const { projectId, taskId } = req.params;
    const uploadPath = path.join(
      process.cwd(),
      "public",
      "images",
      projectId || "tmp",
      taskId || "tmp",
    );
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const basename = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "");
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  },
});

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
