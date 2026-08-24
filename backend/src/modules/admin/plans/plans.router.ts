import { Router } from "express";
import {
  listPlansHandler,
  getPlanHandler,
  createPlanHandler,
  updatePlanHandler,
  deletePlanHandler,
} from "./plans.controller";

// Mounted under /admin/plans; requireSystemAdmin is applied by the parent router.
const router = Router();

router.get("/", listPlansHandler);
router.post("/", createPlanHandler);
router.get("/:key", getPlanHandler);
router.patch("/:key", updatePlanHandler);
router.delete("/:key", deletePlanHandler);

export const plansRouter = router;
