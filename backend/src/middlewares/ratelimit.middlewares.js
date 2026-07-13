// Rate limiting middleware for unauthenticated endpoints
// Custom in-memory rate limiter - Tracks requests by IP address and endpoint
// Production scaling note: For multi-instance deployments, migrate to Redis-backed store.
// Usage: const store = new RedisStore({ client, prefix: 'rl:' }) and pass to RateLimiter
class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 3) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map(); // Map<IP, Array<timestamps>>
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();

      if (!this.requests.has(ip)) {
        this.requests.set(ip, []);
      }

      const timestamps = this.requests.get(ip);
      // Remove old timestamps outside the window
      const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
      this.requests.set(ip, validTimestamps);

      if (validTimestamps.length >= this.maxRequests) {
        return res.status(429).json({
          success: false,
          statusCode: 429,
          message: 'Too many requests, please try again later',
        });
      }

      validTimestamps.push(now);
      next();
    };
  }
}

// Create limiter instances with appropriate limits
const registerLimiter = new RateLimiter(15 * 60 * 1000, 3); // 3 per 15 minutes
const invitePreviewLimiter = new RateLimiter(15 * 60 * 1000, 30); // 30 per 15 minutes
const inviteAcceptLimiter = new RateLimiter(15 * 60 * 1000, 5); // 5 per 15 minutes

// Export middleware functions
export const limitRegister = registerLimiter.middleware();
export const limitInvitePreview = invitePreviewLimiter.middleware();
export const limitInviteAccept = inviteAcceptLimiter.middleware();
