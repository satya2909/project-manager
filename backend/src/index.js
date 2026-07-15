import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up 2 levels: src -> backend -> project root
dotenv.config({ path: path.resolve(__dirname, "../..", ".env") });

// Dynamic imports (not static) so nothing below is evaluated until dotenv has
// actually populated process.env — static imports are hoisted and would run
// before the dotenv.config() call above, leaving app.js's module-level env
// reads (NODE_ENV, CORS_ORIGIN) seeing undefined.
const { validateEnv } = await import("./utils/validate-env.js");
validateEnv();

const { default: connectDB } = await import("./db/database.js");
const { default: app } = await import("./app.js");

const port = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });
