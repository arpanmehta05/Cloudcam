import { Request, Response } from "express";
import { generateAzureSetup } from "../services/setup.service";
import { saveAzureConnectionService } from "../services/save-connection.service";
import { ActionRequest, AuditLog } from "../../../models/action.model";
import { invalidateUser } from "../../../middleware/response-cache";
import { getUserId } from "./helper";

export * from "./resource.controller";
export * from "./alarm.controller";

export async function azureSetupPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const { tenantId, subscriptionId, principalId, enableLogAnalytics } =
      req.body || {};
    const result = await generateAzureSetup(userId, {
      tenantId,
      subscriptionId,
      principalId,
      enableLogAnalytics: !!enableLogAnalytics,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[azureSetupPost] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate Azure setup" });
  }
}

export async function azureSaveConnectionPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const {
      tenantId,
      subscriptionId,
      clientId,
      clientSecret,
      principalId,
      enabledModules,
      logForwardingEnabled,
    } = req.body;

    if (!tenantId || !subscriptionId) {
      return res.status(400).json({ success: false, error: "Missing required fields: tenantId, subscriptionId" });
    }

    // Deploy-to-Azure pingback flow
    if (principalId && !clientId && !clientSecret) {
      const { saveAzureConnection } = require("../../../store/workspace-credentials");
      await saveAzureConnection(userId, { tenantId: tenantId.trim(), subscriptionId: subscriptionId.trim(), principalId: principalId.trim() }, enabledModules, logForwardingEnabled);
      invalidateUser(userId);

      const actionReq = await ActionRequest.create({
        userId,
        actionId: "azure-connection-save",
        displayName: "Save Azure Connection (Deploy-to-Azure)",
        service: "azure",
        targets: [{ resourceId: subscriptionId.trim(), resourceName: `Azure Subscription: ${subscriptionId.trim()}`, region: "global", status: "completed" }],
        status: "completed",
        riskLevel: "low",
        reversible: false,
        estimatedSavings: 0,
        simulationMode: false,
        completedAt: new Date(),
      });
      await AuditLog.create({
        event: "executed",
        userId,
        actionId: "azure-connection-save",
        requestId: actionReq._id.toString(),
        targets: [subscriptionId.trim()],
        changes: [{ tenantId, subscriptionId, principalId }],
        timestamp: new Date(),
      });

      return res.json({
        success: true,
        message: "Azure connection saved successfully (Deploy-to-Azure)",
        connection: { connected: true, provider: "azure", tenantId: tenantId.trim(), subscriptionId: subscriptionId.trim(), principalId: principalId.trim(), connectedAt: new Date().toISOString() },
      });
    }

    if (!clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Missing required fields: clientId, clientSecret for manual connection" });
    }

    const result = await saveAzureConnectionService(userId, {
      tenantId: tenantId.trim(),
      subscriptionId: subscriptionId.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });

    invalidateUser(userId);

    const actionReq = await ActionRequest.create({
      userId,
      actionId: "azure-connection-save",
      displayName: "Save Azure Connection",
      service: "azure",
      targets: [{ resourceId: subscriptionId.trim(), resourceName: `Azure Subscription: ${subscriptionId.trim()}`, region: "global", status: "completed" }],
      status: "completed",
      riskLevel: "low",
      reversible: false,
      estimatedSavings: 0,
      simulationMode: false,
      completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed",
      userId,
      actionId: "azure-connection-save",
      requestId: actionReq._id.toString(),
      targets: [subscriptionId.trim()],
      changes: [{ tenantId, subscriptionId }],
      timestamp: new Date(),
    });

    res.json(result);
  } catch (error: any) {
    console.error("[azureSaveConnectionPost] Error:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to save Azure connection" });
  }
}
