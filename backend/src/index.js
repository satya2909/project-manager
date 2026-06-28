import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up 3 levels: src -> backend -> project root
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env") });

console.log("MONGO_URI:", process.env.MONGO_URI ? "✓ loaded" : "✗ missing");

import connectDB from "./db/database.js";
import app from "./app.js";

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
