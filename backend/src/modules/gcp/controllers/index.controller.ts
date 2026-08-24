import { Request, Response } from "express";
import { generateGcpSetup } from "../services/setup.service";
import {
  saveGcpConnection,
  getCredentials,
} from "../../../store/workspace-credentials";
import { invalidateUser } from "../../../middleware/response-cache";
import { ActionRequest, AuditLog } from "../../../models/action.model";
import { getUserId } from "./helper";

export * from "./resource.controller";
export * from "./alarm.controller";

export async function gcpSetupPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const result = await generateGcpSetup(userId, req);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[gcpSetupPost] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate GCP setup" });
  }
}

export async function gcpSaveConnectionPost(req: Request, res: Response) {
  try {
    const bodyWorkspaceId = req.body.workspaceId;
    const userId = bodyWorkspaceId || getUserId(req);
    const { projectId, clientEmail, privateKey, billingDatasetId, billingTableId, enabledModules, logForwardingEnabled } = req.body;

    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "Missing required fields: projectId, clientEmail, privateKey" });
    }

    await saveGcpConnection(userId, {
      projectId: projectId.trim(),
      clientEmail: clientEmail.trim(),
      privateKey: privateKey.trim(),
      billingDatasetId: billingDatasetId ? billingDatasetId.trim() : undefined,
      billingTableId: billingTableId ? billingTableId.trim() : undefined,
    }, enabledModules, logForwardingEnabled);

    invalidateUser(userId);

    const actionReq = await ActionRequest.create({
      userId, actionId: "gcp-connection-save", displayName: "Save GCP Connection", service: "gcp",
      targets: [{ resourceId: projectId.trim(), resourceName: `GCP Project: ${projectId.trim()}`, region: "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: false, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "gcp-connection-save", requestId: actionReq._id.toString(),
      targets: [projectId.trim()], changes: [{ projectId, clientEmail }], timestamp: new Date(),
    });

    res.json({
      success: true, message: "GCP connection saved successfully",
      connection: {
        connected: true, provider: "gcp", projectId: projectId.trim(), clientEmail: clientEmail.trim(),
        billingDatasetId: billingDatasetId ? billingDatasetId.trim() : undefined,
        billingTableId: billingTableId ? billingTableId.trim() : undefined,
        connectedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[gcpSaveConnectionPost] Error:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to save GCP connection" });
  }
}

export async function gcpUpdateBillingPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const { billingDatasetId, billingTableId } = req.body;
    const existing = await getCredentials(userId, "gcp");
    if (!existing || !existing.projectId || !existing.clientEmail || !existing.privateKey) {
      return res.status(400).json({ success: false, error: "GCP connection not found. Please connect the project first." });
    }
    await saveGcpConnection(userId, {
      projectId: existing.projectId,
      clientEmail: existing.clientEmail,
      privateKey: existing.privateKey,
      billingDatasetId: billingDatasetId ? billingDatasetId.trim() : undefined,
      billingTableId: billingTableId ? billingTableId.trim() : undefined,
    }, existing.enabledModules, existing.logForwardingEnabled);
    invalidateUser(userId);
    res.json({
      success: true, message: "GCP billing export settings updated successfully",
      connection: {
        connected: true, provider: "gcp", projectId: existing.projectId, clientEmail: existing.clientEmail,
        billingDatasetId: billingDatasetId ? billingDatasetId.trim() : undefined,
        billingTableId: billingTableId ? billingTableId.trim() : undefined,
        connectedAt: existing.connectedAt || new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[gcpUpdateBillingPost] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update GCP billing settings" });
  }
}
