import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ApiError } from "./utils/api-error.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Routers ──────────────────────────────────────────────────────────────────
import authRouter from "./routes/auth.routes.js";
import inviteRouter from "./routes/invite.routes.js";
import organizationRouter from "./routes/organization.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import noteRouter from "./routes/note.routes.js";
import activityRouter from "./routes/activity.routes.js";
import integrationRouter from "./routes/integration.routes.js";

const app = express();

// Trust the first hop (Render/Railway/Heroku-style reverse proxy) so
// req.ip and express-rate-limit see the real client IP from X-Forwarded-For.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ─── Security Headers ─────────────────────────────────────────────────────────
// CSP is left off: the frontend's index.html has an inline first-paint theme
// script and loads Google Fonts, both of which a default helmet CSP would
// block. Enable it once those are moved to nonce/hash-based sources and the
// Google Fonts domains are allow-listed — don't ship a CSP that's untested
// against the app's actual asset origins.
app.use(helmet({ contentSecurityPolicy: false }));

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ limit: "16kb", extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// "*" is invalid together with credentials: true (browsers reject it), and
// validateEnv() requires CORS_ORIGIN in production, so this fallback only
// ever applies in local dev. Supports a comma-separated list for multiple
// allowed frontends (e.g. staging + production).
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, server-to-server, same-origin) — allow.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new ApiError(403, "Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/invites", inviteRouter);
app.use("/api/v1/organizations", organizationRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);
app.use("/api/v1/activity", activityRouter);
app.use("/api/v1/integrations", integrationRouter);

app.get("/api/v1/healthcheck", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

// ─── Frontend (single-service deploy) ────────────────────────────────────────
// Serves the Vite production build when present, so the backend and frontend
// can deploy as one service on the same origin (matches the frontend's
// relative "/api/v1" axios baseURL — no CORS_ORIGIN needed in that setup).
// In local dev this directory doesn't exist yet, so the block is a no-op and
// the Vite dev server (with its /api/v1 proxy) handles the frontend instead.
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, _res, next) => {
  next(new ApiError(404, "Route not found"));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

export default app;
