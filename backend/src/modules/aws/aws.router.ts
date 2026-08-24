import { Router } from "express";
import {
  defaultAlarmsGet,
  defaultAlarmsPost,
  alarmsGet,
  alarmsPost,
  alarmPut,
  alarmTogglePatch,
  alarmDelete,
  alarmMetadataServicesGet,
  alarmMetadataResourcesGet,
  alarmMetadataSnsGet,
} from "./controllers/alarms.controller";
import { billingGet } from "./controllers/billing.controller";
import {
  credentialsGet,
  credentialsDelete,
  saveRolePost,
} from "./controllers/credentials.controller";
import {
  vaultCredentialsGet,
  vaultCredentialsPost,
  vaultCredentialDelete,
} from "./controllers/aws-credential-vault.controller";
import { insightsGet } from "./controllers/insights.controller";
import { logsGet } from "./controllers/logs.controller";
import { metricsGet } from "./controllers/metrics.controller";
import { resourcesGet } from "./controllers/resources.controller";
import {
  liveActionPost,
  liveActionSafetyCheck,
  liveLambdaGetCode,
} from "./controllers/live-action.controller";
import { securityGet } from "./controllers/security.controller";
import { setupPost } from "./controllers/setup.controller";
import {
  optimizationGet,
  optimizationRefreshPost,
  optimizationValidatePost,
} from "./controllers/optimization.controller";
import {
  actionPlanPost,
  actionPlanFromRecPost,
  actionPreviewPost,
  actionCreatePost,
  actionRegistryGet,
} from "./controllers/actions.controller";
import {
  actionSimulationLogPost,
  actionApprovePost,
  actionExecutePost,
  actionRollbackPost,
} from "./controllers/action-run.controller";
import {
  actionHistoryGet,
  actionStatusGet,
  actionSavingsGet,
  actionSavingsVerifyPost,
  actionAuditGet,
} from "./controllers/action-history.controller";
import { requireRole, authOrWebhookSecret, authMiddleware } from "../auth";
import { FEATURE_KEYS, requireFeature } from "../admin";

const router = Router();

// Public webhook / auth
router.post("/save-role", authOrWebhookSecret, saveRolePost);

// Debug / ops routes (no user-auth required — machine-to-machine)
router.get("/simulations-status-local", async (req, res) => {
  try {
    const { PersistentSimulationModel } = await import("../../models/simulation-persistent.model");
    const { AwsCredentialVaultModel } = await import("../../models/aws-credential-vault.model");
    const { resolveVaultCredential } = await import("../../services/aws-credential-vault.service");
    const sims = await PersistentSimulationModel.find({});
    const simsWithVault = [];
    for (const sim of sims) {
      const userId = String(sim.get("userId"));
      const vaults = await AwsCredentialVaultModel.find({ userId });
      const vaultList = [];
      for (const v of vaults) {
        let decryptedCreds = null;
        try {
          decryptedCreds = await resolveVaultCredential(userId, String(v._id));
        } catch (err: any) {
          decryptedCreds = { error: err.message };
        }
        vaultList.push({ id: v._id, name: v.get("name"), accessKeyId: decryptedCreds?.accessKeyId, region: v.get("defaultRegion") });
      }
      simsWithVault.push({ id: sim._id, name: sim.get("name"), status: sim.get("status"), userId, region: sim.get("region"), deployments: sim.get("deployments"), vaultList });
    }
    return res.json({ success: true, sims: simsWithVault });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/simulations-force-destroy-local", async (req, res) => {
  try {
    const { PersistentSimulationModel } = await import("../../models/simulation-persistent.model");
    const { startPersistentSimulationDestroy } = await import("../../services/terraform-deployment.service");
    const sims = await PersistentSimulationModel.find({ status: { $ne: "destroyed" } });
    if (sims.length === 0) return res.json({ success: true, message: "No active simulations to destroy" });
    const results = [];
    for (const sim of sims) {
      const deployments = sim.deployments || [];
      const activeDeployments = deployments.filter((d: any) => d.status === "active" || d.status === "failed");
      for (const activeDeployment of activeDeployments) {
        const result = await startPersistentSimulationDestroy(
          String(sim.userId), String(sim._id), activeDeployment.deploymentId,
          process.env.AWS_ACCESS_KEY_ID || "", process.env.AWS_SECRET_ACCESS_KEY || "",
          process.env.AWS_SESSION_TOKEN || "", activeDeployment.region || sim.region || "us-east-1",
          { provider: activeDeployment.provider || "aws" }
        );
        results.push({ simulationId: sim._id, deploymentId: activeDeployment.deploymentId, result });
      }
    }
    return res.json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Apply authMiddleware to all subsequent routes
router.use(authMiddleware);

// Protected routes
router.get("/alarms/defaults", defaultAlarmsGet);
router.post("/alarms/defaults", defaultAlarmsPost);
router.get("/alarms", alarmsGet);
router.post("/alarms", alarmsPost);
router.put("/alarms/:name", alarmPut);
router.patch("/alarms/:name/toggle", alarmTogglePatch);
router.delete("/alarms", alarmDelete);
router.get("/alarm-metadata/services", alarmMetadataServicesGet);
router.get("/alarm-metadata/resources", alarmMetadataResourcesGet);
router.get("/alarm-metadata/sns-topics", alarmMetadataSnsGet);
router.get("/billing", requireFeature(FEATURE_KEYS.costExplorer), billingGet);
router.get("/credentials", credentialsGet);
router.delete("/credentials", requireRole(["admin"]), credentialsDelete);
router.get("/credential-vault", vaultCredentialsGet);
router.post("/credential-vault", requireRole(["admin"]), vaultCredentialsPost);
router.delete("/credential-vault/:id", requireRole(["admin"]), vaultCredentialDelete);
router.get("/insights", insightsGet);
router.get("/logs", logsGet);
router.get("/metrics", metricsGet);
router.get("/resources", resourcesGet);
router.post("/resources/:id/action", requireRole(["admin", "operator"]), liveActionPost);
router.get("/resources/:id/safety-check", requireRole(["admin", "operator"]), liveActionSafetyCheck);
router.get("/resources/:id/code", requireRole(["admin", "operator"]), liveLambdaGetCode);
router.get("/security", securityGet);
router.post("/setup", requireRole(["admin"]), setupPost);

// Optimization Engine
router.get("/optimization", requireFeature(FEATURE_KEYS.costExplorer), optimizationGet);
router.post("/optimization/refresh", requireFeature(FEATURE_KEYS.costExplorer), optimizationRefreshPost);
router.post("/optimization/validate/:insightId", requireFeature(FEATURE_KEYS.costExplorer), optimizationValidatePost);

// ─── Actions ───
router.post("/actions/plan", requireFeature(FEATURE_KEYS.costExplorer), requireRole(["admin", "operator"]), actionPlanPost);
router.post("/actions/plan-from-recommendation", requireFeature(FEATURE_KEYS.costExplorer), requireRole(["admin", "operator"]), actionPlanFromRecPost);
router.post("/actions/preview", requireFeature(FEATURE_KEYS.costExplorer), requireRole(["admin", "operator"]), actionPreviewPost);
router.post("/actions/create", requireFeature(FEATURE_KEYS.costExplorer), requireRole(["admin", "operator"]), actionCreatePost);
router.post("/actions/simulation-log", requireRole(["admin", "operator"]), actionSimulationLogPost);
router.post("/actions/approve/:id", requireRole(["admin", "operator"]), actionApprovePost);
router.post("/actions/execute/:id", requireRole(["admin", "operator"]), actionExecutePost);
router.post("/actions/rollback/:id", requireRole(["admin", "operator"]), actionRollbackPost);
router.get("/actions/history", actionHistoryGet);
router.get("/actions/status/:id", actionStatusGet);
router.get("/actions/savings", requireFeature(FEATURE_KEYS.costExplorer), actionSavingsGet);
router.post("/actions/savings/verify", requireFeature(FEATURE_KEYS.costExplorer), actionSavingsVerifyPost);
router.get("/actions/audit", requireFeature(FEATURE_KEYS.costExplorer), actionAuditGet);
router.get("/actions/registry", actionRegistryGet);

export default router;

