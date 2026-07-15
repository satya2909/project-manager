import { Router } from "express";
import { body, param } from "express-validator";
import {
  registerUser,
  verifyEmail,
  loginUser,
  logoutUser,
  getCurrentUser,
  refreshAccessToken,
  changeCurrentPassword,
  forgotPassword,
  resetForgottenPassword,
  resendEmailVerification,
} from "../controllers/auth.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import {
  limitRegister,
  limitLogin,
  limitForgotPassword,
  limitResetPassword,
  limitResendVerification,
} from "../middlewares/ratelimit.middlewares.js";

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

router.post(
  "/register",
  limitRegister,
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Must be a valid email address")
      .normalizeEmail(),
    body("username")
      .trim()
      .notEmpty()
      .withMessage("Username is required")
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be 3–30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores",
      ),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one number"),
    body("fullName")
      .optional()
      .trim()
      .isLength({ max: 60 })
      .withMessage("Full name cannot exceed 60 characters"),
    body("organizationName")
      .trim()
      .notEmpty()
      .withMessage("Organization name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Organization name must be 2–100 characters"),
  ],
  validate,
  registerUser,
);

router.post(
  "/login",
  limitLogin,
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Must be a valid email address")
      .normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  loginUser,
);

router.post("/refresh-token", refreshAccessToken);

router.get(
  "/verify-email/:verificationToken",
  [
    param("verificationToken")
      .notEmpty()
      .withMessage("Verification token is required")
      .isHexadecimal()
      .withMessage("Invalid token format")
      .isLength({ min: 64, max: 64 })
      .withMessage("Invalid token length"),
  ],
  validate,
  verifyEmail,
);

router.post(
  "/forgot-password",
  limitForgotPassword,
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Must be a valid email address")
      .normalizeEmail(),
  ],
  validate,
  forgotPassword,
);

router.post(
  "/reset-password/:resetToken",
  limitResetPassword,
  [
    param("resetToken").notEmpty().withMessage("Reset token is required"),
    body("newPassword")
      .notEmpty()
      .withMessage("New password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one number"),
  ],
  validate,
  resetForgottenPassword,
);

// ─── Protected Routes (require valid access token) ────────────────────────────

router.use(verifyJWT); // all routes below this line require authentication

router.post("/logout", logoutUser);

router.get("/current-user", getCurrentUser);

router.post(
  "/change-password",
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .notEmpty()
      .withMessage("New password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one number"),
  ],
  validate,
  changeCurrentPassword,
);

router.post(
  "/resend-email-verification",
  limitResendVerification,
  resendEmailVerification,
);

export default router;
