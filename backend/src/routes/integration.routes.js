import { Router } from "express";
import {
  getInstallUrl,
  githubCallback,
  getInstallStatus,
  disconnectInstallation,
} from "../controllers/integration.controllers.js";
import { verifyJWT, checkOrgRole } from "../middlewares/auth.middlewares.js";
import { OrgRolesEnum } from "../utils/constants.js";

const router = Router();

// Every integrations route requires authentication — the GitHub App connect
// flow is entirely org-owner-initiated, not a public webhook (that's a
// separate, unauthenticated endpoint built in Phase 3).
router.use(verifyJWT);

router.get("/github/install-url", checkOrgRole(OrgRolesEnum.OWNER), getInstallUrl);
router.get("/github/callback", checkOrgRole(OrgRolesEnum.OWNER), githubCallback);
router.get("/github", checkOrgRole(OrgRolesEnum.ADMIN), getInstallStatus);
router.delete("/github", checkOrgRole(OrgRolesEnum.OWNER), disconnectInstallation);

export default router;
