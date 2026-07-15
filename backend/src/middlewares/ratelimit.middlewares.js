// Rate limiting for unauthenticated / abuse-prone endpoints.
// Uses express-rate-limit's in-memory store — fine for a single instance;
// swap in a Redis store (rate-limit-redis) for multi-instance deployments.
import rateLimit from "express-rate-limit";

const handler = (_req, res) => {
  res.status(429).json({
    success: false,
    statusCode: 429,
    message: "Too many requests, please try again later",
    errors: [],
  });
};

const makeLimiter = (windowMs, max) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
  });

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const limitRegister = makeLimiter(FIFTEEN_MINUTES, 3);
export const limitLogin = makeLimiter(FIFTEEN_MINUTES, 10);
export const limitForgotPassword = makeLimiter(FIFTEEN_MINUTES, 3);
export const limitResetPassword = makeLimiter(FIFTEEN_MINUTES, 5);
export const limitResendVerification = makeLimiter(FIFTEEN_MINUTES, 3);
export const limitInvitePreview = makeLimiter(FIFTEEN_MINUTES, 30);
export const limitInviteAccept = makeLimiter(FIFTEEN_MINUTES, 5);
