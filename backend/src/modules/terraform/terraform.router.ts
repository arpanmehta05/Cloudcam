// ─── Terraform Module Router ───

import { Router } from "express";
import { requireRole, authMiddleware } from "../auth";
import { generateTerraformHandler } from "./controllers/generation.controller";
import {
  deploymentStartPost,
  deploymentRunPost,
  resumeDeploymentPost,
  deploymentCancelPost,
  deploymentStatusGet,
  validateCredsPost,
  deploymentStreamGet,
  deploymentPemDownloadGet,
} from "./controllers/deployment.controller";
import {
  estimateCostHandler,
  getCachedCostEstimate,
} from "./controllers/cost.controller";

const router = Router();

// Apply authMiddleware globally to all terraform infrastructure endpoints
router.use(authMiddleware);

// 1. Deployment routes (mounted at /deployment)
const deploymentRouter = Router();
deploymentRouter.post("/start", requireRole(["admin", "operator"]), deploymentStartPost);
deploymentRouter.post("/:id/run", requireRole(["admin", "operator"]), deploymentRunPost);
deploymentRouter.post("/:id/resume", requireRole(["admin", "operator"]), resumeDeploymentPost);
deploymentRouter.post("/:id/cancel", requireRole(["admin", "operator"]), deploymentCancelPost);
deploymentRouter.get("/:id/status", deploymentStatusGet);
deploymentRouter.post("/validate-creds", requireRole(["admin", "operator"]), validateCredsPost);
deploymentRouter.get("/:id/stream", deploymentStreamGet);
deploymentRouter.get("/:id/download-pem", deploymentPemDownloadGet);

// 2. Simulation infrastructure routes (mounted at /simulation)
const simulationSubRouter = Router();
simulationSubRouter.post("/cost/estimate", requireRole(["admin", "operator"]), estimateCostHandler);
simulationSubRouter.get("/cost/status/:sessionId", getCachedCostEstimate);
simulationSubRouter.post("/terraform", requireRole(["admin", "operator"]), generateTerraformHandler);

// Dispatch requests based on the baseUrl
router.use((req, res, next) => {
  if (req.baseUrl.endsWith("/deployment")) {
    return deploymentRouter(req, res, next);
  } else if (req.baseUrl.endsWith("/simulation")) {
    return simulationSubRouter(req, res, next);
  }
  next();
});

export default router;
