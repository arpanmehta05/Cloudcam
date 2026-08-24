import { Router } from "express";
import { sessionDetailGet, sessionsGet } from "./sessions.controller";

const router = Router();

router.get("/sessions", sessionsGet);
router.get("/sessions/:sessionId", sessionDetailGet);

export default router;
