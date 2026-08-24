// ─── Admin Module Router ───
// Operator-only panel: plans, feature registry, tenant entitlements, audit.
import { Router } from "express";
import { requireSystemAdmin } from "../auth";
import { overviewHandler, listAuditHandler } from "./admin.controller";
import { plansRouter } from "./plans/plans.router";
import { featuresRouter } from "./features/features.router";
import { tenantsRouter } from "./tenants/tenants.router";

const router = Router();

// Every admin route requires a system admin (with 2FA, enforced in the guard).
// authMiddleware runs earlier at the app level in routes/index.ts.
router.use(requireSystemAdmin);

router.get("/overview", overviewHandler);
router.get("/audit", listAuditHandler);
router.use("/plans", plansRouter);
router.use("/features", featuresRouter);
router.use("/tenants", tenantsRouter);

export const adminRouter = router;
