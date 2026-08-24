// ─── AI Keys Sub-Router ───

import { Router } from "express";
import {
  saveAiKeyPost,
  deleteAiKeyPost,
  getAiKeysStatus,
} from "./controllers/keys.controller";
import {
  getOpenAIUsageHandler,
  getOpenAILogsHandler,
  getOpenAIPerKeyHandler,
  getAnthropicUsageHandler,
  getGeminiUsageHandler,
  getPricingHandler,
} from "./controllers/usage.controller";
import { requireRole, authMiddleware } from "../auth";

const router = Router();

// Apply authMiddleware globally to all endpoints under /ai-keys
router.use(authMiddleware);

router.post("/save", requireRole(["admin"]), saveAiKeyPost);
router.post("/delete", requireRole(["admin"]), deleteAiKeyPost);
router.get("/status", getAiKeysStatus);
router.get("/usage/openai", getOpenAIUsageHandler);
router.get("/logs/openai", getOpenAILogsHandler);
router.get("/per-key/openai", getOpenAIPerKeyHandler);
router.get("/usage/anthropic", getAnthropicUsageHandler);
router.get("/usage/gemini", getGeminiUsageHandler);
router.get("/pricing", getPricingHandler);

export default router;
