import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import connectDB from "../db/database.js";
import app from "../app.js";

const port = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      // Fixed: was using single quotes (no interpolation) in original code
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed, server not started:", err);
    process.exit(1);
  });

export { User } from "./user.models.js";
export { Project } from "./project.models.js";
export { Task } from "./task.models.js";
export { SubTask } from "./subtask.models.js";
export { ProjectNote } from "./projectnote.models.js";