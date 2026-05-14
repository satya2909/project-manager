import { validationResult } from "express-validator";
import { ApiError } from "../utils/api-error.js";

// Runs after express-validator chains on a route.
// Collects all validation errors and throws a single 422 ApiError
// with the full list of field-level messages.
//
// Usage: place after validator chains, before the controller:
//   router.post("/register", [...validators], validate, registerUser)

export const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  // Format: [{ field: "email", message: "Must be a valid email" }, ...]
  const extractedErrors = errors.array().map((err) => ({
    field: err.path,
    message: err.msg,
  }));

  throw new ApiError(422, "Validation failed", extractedErrors);
};
