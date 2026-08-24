/* eslint-disable import/no-restricted-paths */
// GCP Module Router — all /gcp/* routes
// Canonical location: modules/gcp/gcp.router.ts
import { Router } from "express";
import { authOrWebhookSecret, requireRole, authMiddleware } from "../auth";
import {
  gcpSetupPost,
  gcpSaveConnectionPost,
  gcpUpdateBillingPost,
  gcpBillingGet,
  gcpLogsGet,
  gcpMetricsGet,
  gcpResourcesGet,
  gcpInsightsGet,
  gcpSecurityGet,
  gcpAlarmsGet,
  gcpAlarmsPost,
  gcpAlarmDelete,
  gcpAlarmTogglePatch,
  gcpDefaultAlarmsGet,
  gcpDefaultAlarmsPost,
  gcpAlarmMetadataServicesGet,
  gcpAlarmMetadataResourcesGet,
  gcpAlarmMetadataActionGroupsGet,
} from "./controllers/index.controller";
import { gcpLiveActionPost } from "./controllers/live-action.controller";

const gcpRouter = Router();

// ─── Public/Webhook Routes (no auth required) ───
gcpRouter.post("/save-connection", authOrWebhookSecret, gcpSaveConnectionPost);

// ─── Protected Routes ───
gcpRouter.use(authMiddleware);

gcpRouter.post("/setup", requireRole(["admin"]), gcpSetupPost);
gcpRouter.post("/update-billing", requireRole(["admin"]), gcpUpdateBillingPost);

gcpRouter.get("/billing", gcpBillingGet);
gcpRouter.get("/logs", gcpLogsGet);
gcpRouter.get("/metrics", gcpMetricsGet);
gcpRouter.get("/resources", gcpResourcesGet);
gcpRouter.get("/insights", gcpInsightsGet);
gcpRouter.get("/security", gcpSecurityGet);

// Resources live-action (operator+)
gcpRouter.post("/resources/:id/action", requireRole(["admin", "operator"]), gcpLiveActionPost);

// Alarms CRUD
gcpRouter.get("/alarms", gcpAlarmsGet);
gcpRouter.post("/alarms", gcpAlarmsPost);
gcpRouter.patch("/alarms/:name/toggle", gcpAlarmTogglePatch);
gcpRouter.delete("/alarms", gcpAlarmDelete);
gcpRouter.get("/alarms/defaults", gcpDefaultAlarmsGet);
gcpRouter.post("/alarms/defaults", gcpDefaultAlarmsPost);

// Alarm Metadata
gcpRouter.get("/alarm-metadata/services", gcpAlarmMetadataServicesGet);
gcpRouter.get("/alarm-metadata/resources", gcpAlarmMetadataResourcesGet);
gcpRouter.get("/alarm-metadata/sns-topics", gcpAlarmMetadataActionGroupsGet);

// ─── GCP Credentials (shared AWS credential handler with provider=gcp) ───
import { credentialsGet, credentialsDelete } from "../aws/controllers/credentials.controller";
gcpRouter.get("/credentials", (req, res, next) => { req.params.provider = "gcp"; next(); }, credentialsGet);
gcpRouter.delete("/credentials", requireRole(["admin"]), (req, res, next) => { req.params.provider = "gcp"; next(); }, credentialsDelete);

export { gcpRouter };

