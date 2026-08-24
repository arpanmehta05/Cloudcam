import { Router } from "express";

import { getEvaluations, runEvaluation } from "./evaluation-dashboard.controller";

const router = Router();

router.get("/", getEvaluations);
router.post("/run", runEvaluation);

export const evaluationDashboardRouter = router;
