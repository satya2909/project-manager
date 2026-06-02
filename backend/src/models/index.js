import dotenv from "dotenv";
import connectDB from "../db/database.js";
import app from "../app.js";

dotenv.config({
  path: "./.env",
});

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