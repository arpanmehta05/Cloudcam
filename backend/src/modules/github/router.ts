// ─── GitHub Module Router: /github/* ───
import { Router } from "express";
import { requireRole } from "../auth";
import {
    githubStatus,
    githubConnect,
    githubDisconnect,
    githubRepos,
    githubBranches
} from "./controllers/github.controller";

const router = Router();

// All require authMiddleware applied at parent level
router.get("/status", githubStatus);
router.post("/connect", requireRole(["admin"]), githubConnect);
router.delete("/disconnect", requireRole(["admin"]), githubDisconnect);
router.get("/repos", githubRepos);
router.get("/branches", githubBranches);

export const githubRouter = router;
