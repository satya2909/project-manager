import { Router } from "express";
import { githubWebhook } from "../controllers/webhook.controllers.js";

const router = Router();

// Public, unauthenticated — GitHub itself calls this. Deliberately no
// verifyJWT: authenticity is established by the X-Hub-Signature-256 check
// inside the controller, not a bearer token.
router.post("/github/webhook", githubWebhook);

export default router;
