// ─── Evaluations Module Router: /evaluations/* ───
import { Router } from "express";
import { evaluationDashboardRouter } from "./dashboard";

const router = Router();

// All require authMiddleware applied at parent level

router.use("/", evaluationDashboardRouter);

export const evaluationsRouter = router;
