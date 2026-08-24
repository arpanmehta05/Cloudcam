// ─── Simulation Module Router ───

import { Router } from "express";
import { requireRole, authMiddleware } from "../auth";
import { FEATURE_KEYS, requireFeature } from "../admin";
import {
  createSession,
  getSessionStatus,
  streamSession,
  terminateSession,
} from "./controllers/session.controller";
import {
  parseHclToGraph,
  deployDirectHcl,
} from "./controllers/hcl-playground.controller";
import {
  simulationCreatePost,
  simulationsListGet,
  simulationDetailGet,
  simulationUpdatePut,
  simulationDestroyPost,
  simulationDelete,
  simulationPemDownloadGet,
} from "./controllers/persistent.controller";

const router = Router();

// Apply authMiddleware globally to all simulation endpoints
router.use(authMiddleware);
router.use(requireFeature(FEATURE_KEYS.simulations));

// 1. Live Session routes (mounted at /simulation)
const sessionRouter = Router();
sessionRouter.post("/session", requireRole(["admin", "operator"]), createSession);
sessionRouter.get("/session/:id", getSessionStatus);
sessionRouter.get("/session/:id/stream", streamSession);
sessionRouter.post("/session/:id/terminate", requireRole(["admin", "operator"]), terminateSession);
sessionRouter.post("/hcl-playground/parse", parseHclToGraph);
sessionRouter.post("/hcl-playground/deploy", requireRole(["admin", "operator"]), deployDirectHcl);

// 2. Persistent CRUD routes (mounted at /simulations)
const persistentRouter = Router();
persistentRouter.post("/", requireRole(["admin", "operator"]), simulationCreatePost);
persistentRouter.get("/", simulationsListGet);
persistentRouter.get("/:id", simulationDetailGet);
persistentRouter.put("/:id", requireRole(["admin", "operator"]), simulationUpdatePut);
persistentRouter.post("/:id/destroy", requireRole(["admin", "operator"]), simulationDestroyPost);
persistentRouter.delete("/:id", requireRole(["admin", "operator"]), simulationDelete);
persistentRouter.get("/:id/download-pem", simulationPemDownloadGet);

// Dispatch requests to the appropriate sub-router based on the baseUrl
router.use((req, res, next) => {
  if (req.baseUrl.endsWith("/simulation")) {
    return sessionRouter(req, res, next);
  } else if (req.baseUrl.endsWith("/simulations")) {
    return persistentRouter(req, res, next);
  }
  next();
});

export default router;
