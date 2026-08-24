// ─── Usage Reports Module Router: /usage-reports/* ───
import { Router } from "express";
import { requireRole } from "../auth";
import {
    usageReportPreferencesGet,
    usageReportPreferencesPut,
    usageReportTestPost,
} from "../../controllers/usage-report.controller";

const router = Router();

// All require authMiddleware applied at parent level
router.get("/preferences", usageReportPreferencesGet);
router.put("/preferences", requireRole(["admin"]), usageReportPreferencesPut);
router.post("/test", requireRole(["admin"]), usageReportTestPost);

export const usageReportsRouter = router;
