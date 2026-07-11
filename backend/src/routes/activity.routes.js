import { Router } from "express";
import { getProjectActivity } from "../controllers/activity.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { attachProject } from "../middlewares/project.middlewares.js";

const router = Router();

router.use(verifyJWT);

// GET /activity/:projectId — list recent activity for a project
// attachProject verifies the requesting user is a project member
router.get("/:projectId", attachProject, getProjectActivity);

export default router;
