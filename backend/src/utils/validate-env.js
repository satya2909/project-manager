// Fails fast with a clear message if required environment variables are
// missing, instead of surfacing as a cryptic error the first time each
// var is used (e.g. jwt.sign(undefined) or a Mongo connection hang).
const ALWAYS_REQUIRED = [
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];

// Only enforced in production — local/dev can run without email or an
// explicit CORS origin, but going live without them is a config mistake.
const REQUIRED_IN_PRODUCTION = [
  "CORS_ORIGIN",
  "CLIENT_URL",
  "SMTP_PASS",
  "SMTP_FROM",
];

export function validateEnv() {
  const required =
    process.env.NODE_ENV === "production"
      ? [...ALWAYS_REQUIRED, ...REQUIRED_IN_PRODUCTION]
      : ALWAYS_REQUIRED;

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(", ")}\n` +
        "See .env.example for the full list of expected variables.",
    );
    process.exit(1);
  }
}
