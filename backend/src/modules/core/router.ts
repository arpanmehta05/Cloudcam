// ─── Core Module Router: watchdog, AI analysis, chat ───
import { Router } from "express";
import { watchdogGet, aiPost, chatPost } from "../../controllers/index.controller";
import { FEATURE_KEYS, requireFeature } from "../admin";

const router = Router();

// All require authMiddleware applied at parent level
router.get("/watchdog", requireFeature(FEATURE_KEYS.watchdog), watchdogGet);
router.post("/ai", aiPost);
router.post("/chat", chatPost);

export const coreRouter = router;
