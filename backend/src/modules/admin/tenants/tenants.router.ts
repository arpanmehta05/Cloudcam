import { Router } from "express";
import {
  listTenantsHandler,
  getTenantHandler,
  assignPlanHandler,
  setOverridesHandler,
} from "./tenants.controller";

// Mounted under /admin/tenants; requireSystemAdmin applied by the parent router.
const router = Router();

router.get("/", listTenantsHandler);
router.get("/:id", getTenantHandler);
router.put("/:id/plan", assignPlanHandler);
router.put("/:id/overrides", setOverridesHandler);

export const tenantsRouter = router;
