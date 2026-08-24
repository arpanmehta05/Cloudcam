// ─── Route Definitions — composed entirely from module sub-routers ───
// No flat route definitions here. Every domain owns its own router.ts.
import { Router } from "express";
import { authMiddleware } from "../modules/auth";
import { authRouter } from "../modules/auth";
import { otpRouter } from "../modules/otp";
import { oauthRouter } from "../modules/oauth";
import { awsRouter } from "../modules/aws";
import { azureRouter } from "../modules/azure";
import { gcpRouter } from "../modules/gcp";
import { cloudRouter } from "../modules/cloud";
import { aiObservabilityRouter, getNotificationHistoryHandler } from "../modules/ai-observability";
import { aiKeysRouter } from "../modules/ai-keys";
import { simulationRouter } from "../modules/simulation";
import { terraformRouter } from "../modules/terraform";
import { resizeMigrationRouter } from "../modules/resize-migration";
import { vpsLogsRouter } from "../modules/vps-logs";
import { slackRouter } from "../modules/slack";
import { notificationsRouter } from "../modules/notifications";

import { teamRouter } from "../modules/team";
import { adminRouter, entitlementsRouter } from "../modules/admin";
import { coreRouter } from "../modules/core";
import { integrationsRouter } from "../modules/integrations";
import { githubRouter } from "../modules/github";
import { usageReportsRouter } from "../modules/usage-reports";
import { promptsRouter } from "../modules/prompts";
import { evaluationsRouter } from "../modules/evaluations";
import { cloudWatcherRouter } from "../modules/cloudwatcher";
import { publicPlansRouter } from "./plans.router";

const router = Router();

// ─── Public & Self-Authed Routes ───
router.use("/auth", authRouter);
router.use("/auth/otp", otpRouter);
router.use("/oauth", oauthRouter);
router.use("/plans", publicPlansRouter);
router.use("/v1", cloudWatcherRouter);

// Fallback redirect for legacy/cached client logging route
router.post("/actions/simulation-log", (req, res) => {
  res.redirect(307, "/api/aws/actions/simulation-log");
});

router.use("/aws", awsRouter);             // self-manages authMiddleware internally
router.use("/azure", azureRouter);
router.use("/gcp", gcpRouter);
router.use("/ai-observability", aiObservabilityRouter);  // self-manages auth internally
router.use("/prompts", promptsRouter);          // self-manages auth internally
router.use("/vps-logs", vpsLogsRouter);

router.use("/integrations/slack", slackRouter);

// ─── Protected Routes (all behind authMiddleware) ───
router.use(authMiddleware);

router.use("/", coreRouter);                              // /watchdog, /ai, /chat
router.use("/cloud", cloudRouter);
router.use("/auth/integrations", integrationsRouter);
router.use("/auth/team", teamRouter);
router.get("/auth/notifications/history", getNotificationHistoryHandler);
router.use("/github", githubRouter);
router.use("/usage-reports", usageReportsRouter);
router.use("/settings/notifications", notificationsRouter);
router.use("/ai-keys", aiKeysRouter);
router.use("/evaluations", evaluationsRouter);
router.use("/resize-migration", resizeMigrationRouter);
router.use("/simulation", simulationRouter);
router.use("/simulations", simulationRouter);
router.use("/simulation", terraformRouter);
router.use("/deployment", terraformRouter);
router.use("/admin", adminRouter); // operator panel — requireSystemAdmin inside
router.use("/entitlements", entitlementsRouter); // caller's own resolved entitlements

export default router;
