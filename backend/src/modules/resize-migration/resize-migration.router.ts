import { Router } from "express";
import { requireRole } from "../auth";
import {
  resizeMigrationScopeGet,
  resizeMigrationSourcesGet,
  resizeMigrationTargetSizesGet,
  resizeMigrationJobsListGet,
  resizeMigrationJobCreatePost,
  resizeMigrationJobDelete,
  resizeMigrationJobGet,
  resizeMigrationJobTransitionPost,
  resizeMigrationJobConfirmClassificationPost,
  resizeMigrationJobConfigureAccessPost,
  resizeMigrationJobResumePost,
  resizeMigrationJobReportGet,
  resizeMigrationJobExplainGet,
} from "./controllers/resize-migration.controller";

const router = Router();

router.get("/scope", resizeMigrationScopeGet);
router.get("/sources", resizeMigrationSourcesGet);
router.get("/target-sizes", resizeMigrationTargetSizesGet);
router.get("/jobs", resizeMigrationJobsListGet);
router.post("/jobs", requireRole(["admin", "operator"]), resizeMigrationJobCreatePost);
router.post("/plan", requireRole(["admin", "operator"]), resizeMigrationJobCreatePost);
router.delete("/:id", requireRole(["admin", "operator"]), resizeMigrationJobDelete);
router.get("/:id", resizeMigrationJobGet);
router.post("/:id/transition", requireRole(["admin", "operator"]), resizeMigrationJobTransitionPost);
router.post("/:id/confirm-classification", requireRole(["admin", "operator"]), resizeMigrationJobConfirmClassificationPost);
router.post("/:id/configure-access", requireRole(["admin", "operator"]), resizeMigrationJobConfigureAccessPost);
router.post("/:id/resume", requireRole(["admin", "operator"]), resizeMigrationJobResumePost);
router.get("/:id/report", resizeMigrationJobReportGet);
router.get("/:id/explain/:taskKey", resizeMigrationJobExplainGet);

export default router;
