// Wraps an async controller function so any thrown error or rejected promise
// is automatically forwarded to Express's next(err) error handler.
//
// Usage:
//   router.get("/path", asyncHandler(async (req, res) => { ... }));
//
// Without this, an unhandled promise rejection inside a controller would
// crash the process in older Node versions or silently hang in newer ones.

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export { asyncHandler };
