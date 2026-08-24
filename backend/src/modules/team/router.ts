// ─── Team Module Router ───
import { Router } from "express";
import { requireRole } from "../../modules/auth";
import { getTeamHandler, createTeamUserHandler, deleteTeamUserHandler } from "./controllers/team-members.controller";
import { updateTeamUserHandler, resetTeamUserPasswordHandler } from "./controllers/team-admin.controller";

const router = Router();

// All team routes are admin-only (caller mounts this under authMiddleware)
router.get("/", requireRole(["admin"]), getTeamHandler);
router.post("/", requireRole(["admin"]), createTeamUserHandler);
router.put("/:userId", requireRole(["admin"]), updateTeamUserHandler);
router.post("/:userId/reset-password", requireRole(["admin"]), resetTeamUserPasswordHandler);
router.delete("/:userId", requireRole(["admin"]), deleteTeamUserHandler);

export const teamRouter = router;
