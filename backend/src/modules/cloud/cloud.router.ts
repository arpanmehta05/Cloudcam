// Cloud Module Router — all /cloud/* routes
// Canonical location: modules/cloud/cloud.router.ts
import { Router } from "express";
import {
  providersGet,
  cloudConnectionsGet,
  cloudResourcesGet,
  cloudMetricsGet,
  cloudBillingGet,
  cloudSecurityGet,
  cloudInsightsGet,
  cloudRecommendationsGet,
  cloudLogsGet,
} from "./controllers/cloud.controller";
import { FEATURE_KEYS, requireFeature } from "../admin";

const cloudRouter = Router();

cloudRouter.get("/providers", providersGet);
cloudRouter.get("/connections", cloudConnectionsGet);
cloudRouter.get("/resources", cloudResourcesGet);
cloudRouter.get("/metrics", cloudMetricsGet);
cloudRouter.get("/billing", requireFeature(FEATURE_KEYS.costExplorer), cloudBillingGet);
cloudRouter.get("/security", cloudSecurityGet);
cloudRouter.get("/insights", cloudInsightsGet);
cloudRouter.get("/recommendations", requireFeature(FEATURE_KEYS.costExplorer), cloudRecommendationsGet);
cloudRouter.get("/logs", cloudLogsGet);

export { cloudRouter };
