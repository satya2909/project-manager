import rateLimit from 'express-rate-limit';

// POST /auth/register: 3 registration attempts per 15 minutes per IP
// Prevents registration spam and account enumeration
const limitRegister = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: 'Too many registration attempts, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req, res) => {
    // Don't rate-limit if already rate-limited by another middleware
    return false;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Too many registration attempts, please try again later',
    });
  },
});

// GET /invites/:token: 30 requests per 15 minutes per IP
// Prevents token enumeration (trying many tokens to find valid ones)
const limitInvitePreview = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many invite preview requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Too many invite preview requests, please try again later',
    });
  },
});

// POST /invites/:token/accept: 5 attempts per 15 minutes per IP
// Prevents brute-force account takeover via stolen/guessed invite tokens
const limitInviteAccept = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many invite acceptance attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Too many invite acceptance attempts, please try again later',
    });
  },
});

export {
  limitRegister,
  limitInvitePreview,
  limitInviteAccept,
};
