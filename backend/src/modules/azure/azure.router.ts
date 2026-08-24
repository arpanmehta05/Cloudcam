/* eslint-disable import/no-restricted-paths */
// Azure Module Router — all /azure/* routes
// Canonical location: modules/azure/azure.router.ts
import { Router } from "express";
import { authOrWebhookSecret, requireRole, authMiddleware } from "../auth";
import {
  azureSetupPost,
  azureSaveConnectionPost,
  azureBillingGet,
  azureInsightsGet,
  azureLogsGet,
  azureMetricsGet,
  azureResourcesGet,
  azureSecurityGet,
  azureAlarmsGet,
  azureAlarmsPost,
  azureAlarmDelete,
  azureAlarmTogglePatch,
  azureDefaultAlarmsGet,
  azureDefaultAlarmsPost,
  azureAlarmMetadataServicesGet,
  azureAlarmMetadataResourcesGet,
  azureAlarmMetadataActionGroupsGet,
} from "./controllers/index.controller";
import { azureLiveActionPost } from "./controllers/live-action.controller";

const azureRouter = Router();

// ─── Public/Webhook Routes (no auth required) ───
azureRouter.post("/save-connection", authOrWebhookSecret, azureSaveConnectionPost);

azureRouter.get("/template", (_req, res) => {
  const { azureOnboardingTemplate } = require("../../services/azure/onboarding-template");
  res.json(azureOnboardingTemplate);
});

// ─── Protected Routes ───
azureRouter.use(authMiddleware);

azureRouter.get("/billing", azureBillingGet);
azureRouter.get("/insights", azureInsightsGet);
azureRouter.get("/logs", azureLogsGet);
azureRouter.get("/metrics", azureMetricsGet);
azureRouter.get("/resources", azureResourcesGet);
azureRouter.get("/security", azureSecurityGet);

// Resources live-action (operator+)
azureRouter.post("/resources/:id/action", requireRole(["admin", "operator"]), azureLiveActionPost);

// Alarms CRUD
azureRouter.get("/alarms", azureAlarmsGet);
azureRouter.post("/alarms", azureAlarmsPost);
azureRouter.patch("/alarms/:name/toggle", azureAlarmTogglePatch);
azureRouter.delete("/alarms", azureAlarmDelete);
azureRouter.get("/alarms/defaults", azureDefaultAlarmsGet);
azureRouter.post("/alarms/defaults", azureDefaultAlarmsPost);

// Alarm Metadata
azureRouter.get("/alarm-metadata/services", azureAlarmMetadataServicesGet);
azureRouter.get("/alarm-metadata/resources", azureAlarmMetadataResourcesGet);
azureRouter.get("/alarm-metadata/sns-topics", azureAlarmMetadataActionGroupsGet);

// Setup (admin only)
azureRouter.post("/setup", requireRole(["admin"]), azureSetupPost);

// ─── Azure Credentials (shared AWS credential handler with provider=azure) ───
import { credentialsGet, credentialsDelete } from "../aws/controllers/credentials.controller";
azureRouter.get("/credentials", (req, res, next) => { req.params.provider = "azure"; next(); }, credentialsGet);
azureRouter.delete("/credentials", requireRole(["admin"]), (req, res, next) => { req.params.provider = "azure"; next(); }, credentialsDelete);

export { azureRouter };

