// ─── OAuth Module Router ───
import { Router } from "express";
import { oauthCallbackHandler } from "./controllers/oauth.controller";

const router = Router();

// Public — no auth required (OAuth callback from frontend)
router.post("/callback", oauthCallbackHandler);

export const oauthRouter = router;
