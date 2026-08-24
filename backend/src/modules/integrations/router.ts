// ─── Integrations Module Router: /auth/integrations/* ───
import { Router } from "express";
import { requireRole } from "../auth";
import {
    getIntegrationsHandler,
    saveAiKeyHandler,
    deleteAiKeyHandler,
    deleteCloudHandler,
    deleteGithubHandler,
} from "../../controllers/integrations.controller";

const router = Router();

// All require authMiddleware applied at parent level
router.get("/", getIntegrationsHandler);
router.post("/ai-key", requireRole(["admin"]), saveAiKeyHandler);
router.delete("/ai-key/:provider", requireRole(["admin"]), deleteAiKeyHandler);
router.delete("/cloud/:provider", requireRole(["admin"]), deleteCloudHandler);
router.delete("/github", requireRole(["admin"]), deleteGithubHandler);

export const integrationsRouter = router;
