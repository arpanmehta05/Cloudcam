import { Request, Response } from "express";
import { ActionRequest, AuditLog } from "../../../models/action.model";
import {
  getAzureAlertRules,
  putAzureMetricAlert,
  toggleAzureAlertRule,
  deleteAzureAlertRule,
  getAzureActionGroups,
} from "../providers/alerts.provider";
import {
  provisionDefaultAlarms,
  previewDefaultAlarms,
} from "../services/default-alarms.service";
import { getCached, setCached, invalidatePattern, CacheTTL } from "../../../middleware/response-cache";
import { getResources } from "../services/resources.service";
import { SERVICE_REGISTRY } from "../../../data/service-registry";
import { loadAzureCreds } from "./helper";

export async function azureAlarmsGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const region = (req.query.region as string) || "all";
    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);

    const data = await getAzureAlertRules(tenantId, subscriptionId, clientId, clientSecret, region);
    const response = { success: true, ...data };
    setCached(userId, req, response, CacheTTL.ALARMS);
    res.json(response);
  } catch (error: any) {
    console.error("[azureAlarmsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Azure alerts" });
  }
}

export async function azureAlarmsPost(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const { region, alarm } = req.body;
    if (!region || !alarm || !alarm.name || !alarm.resourceId) {
      return res.status(400).json({ success: false, error: "Missing required alarm parameters" });
    }

    const result = await putAzureMetricAlert(tenantId, subscriptionId, clientId, clientSecret, region, alarm.name, {
      name: alarm.name,
      metric: alarm.metric,
      threshold: alarm.threshold,
      comparison: alarm.comparison,
      period: alarm.period,
      evaluationPeriods: alarm.evaluationPeriods,
      resourceId: alarm.resourceId,
      actions: alarm.actions,
    });

    const actionReq = await ActionRequest.create({
      userId, actionId: "azure-alarm-create", displayName: `Create Azure Alert Rule: ${alarm.name}`, service: "azure-alarms",
      targets: [{ resourceId: alarm.resourceId, resourceName: alarm.name, region: region || "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: true, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "azure-alarm-create", requestId: actionReq._id.toString(),
      targets: [alarm.resourceId], changes: [{ alarmName: alarm.name, metric: alarm.metric, threshold: alarm.threshold }], timestamp: new Date(),
    });

    invalidatePattern(userId, "/azure/alarms");
    res.json(result);
  } catch (error: any) {
    console.error("[azureAlarmsPost] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create Azure metric alert" });
  }
}

export async function azureAlarmDelete(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const alarmName = req.query.alarmName as string;
    if (!alarmName) return res.status(400).json({ success: false, error: "Missing alarmName parameter" });

    const result = await deleteAzureAlertRule(tenantId, subscriptionId, clientId, clientSecret, alarmName);

    const actionReq = await ActionRequest.create({
      userId, actionId: "azure-alarm-delete", displayName: `Delete Azure Alert Rule: ${alarmName}`, service: "azure-alarms",
      targets: [{ resourceId: alarmName, resourceName: alarmName, region: "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: false, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "azure-alarm-delete", requestId: actionReq._id.toString(),
      targets: [alarmName], changes: [{ alarmDeleted: alarmName }], timestamp: new Date(),
    });

    invalidatePattern(userId, "/azure/alarms");
    res.json(result);
  } catch (error: any) {
    console.error("[azureAlarmDelete] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete Azure alert rule" });
  }
}

export async function azureAlarmTogglePatch(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const name = req.params.name as string;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ success: false, error: "Missing or invalid enabled flag" });

    const result = await toggleAzureAlertRule(tenantId, subscriptionId, clientId, clientSecret, name, enabled);

    const actionReq = await ActionRequest.create({
      userId, actionId: "azure-alarm-toggle", displayName: `${enabled ? "Enable" : "Disable"} Azure Alert Rule: ${name}`, service: "azure-alarms",
      targets: [{ resourceId: name, resourceName: name, region: "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: true, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "azure-alarm-toggle", requestId: actionReq._id.toString(),
      targets: [name], changes: [{ alarmToggled: name, enabled }], timestamp: new Date(),
    });

    invalidatePattern(userId, "/azure/alarms");
    res.json(result);
  } catch (error: any) {
    console.error("[azureAlarmTogglePatch] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to toggle Azure alert rule" });
  }
}

export async function azureDefaultAlarmsGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const result = await previewDefaultAlarms(userId, tenantId, subscriptionId, clientId, clientSecret);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[azureDefaultAlarmsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to preview default alarms" });
  }
}

export async function azureDefaultAlarmsPost(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const { alarmActions } = req.body;
    const result = await provisionDefaultAlarms(userId, tenantId, subscriptionId, clientId, clientSecret, alarmActions);

    const actionReq = await ActionRequest.create({
      userId, actionId: "azure-alarms-provision", displayName: "Provision Azure default alert rules", service: "azure-alarms",
      targets: [{ resourceId: subscriptionId, resourceName: `Subscription: ${subscriptionId}`, region: "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: false, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "azure-alarms-provision", requestId: actionReq._id.toString(),
      targets: [subscriptionId], changes: [{ provisionedCount: result.created }], timestamp: new Date(),
    });

    invalidatePattern(userId, "/azure/alarms");
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[azureDefaultAlarmsPost] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to provision default alarms" });
  }
}

export async function azureAlarmMetadataServicesGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const region = (req.query.region as string) || "all";
    const inventory = await getResources(userId, region, tenantId, subscriptionId, clientId, clientSecret);

    const metadataServices = [
      { key: "ec2", label: "Virtual Machines", namespace: "Microsoft.Compute/virtualMachines", dimensionKey: "resourceId", hasResources: (inventory.ec2 || []).length > 0, resourceCount: (inventory.ec2 || []).length, metrics: SERVICE_REGISTRY["ec2"]?.metrics || [] },
      { key: "rds", label: "SQL Databases", namespace: "Microsoft.Sql/servers/databases", dimensionKey: "resourceId", hasResources: (inventory.rds || []).length > 0, resourceCount: (inventory.rds || []).length, metrics: SERVICE_REGISTRY["rds"]?.metrics || [] },
      { key: "s3", label: "Storage Accounts", namespace: "Microsoft.Storage/storageAccounts", dimensionKey: "resourceId", hasResources: (inventory.s3 || []).length > 0, resourceCount: (inventory.s3 || []).length, metrics: SERVICE_REGISTRY["s3"]?.metrics || [] },
    ];

    res.json({ success: true, services: metadataServices });
  } catch (error: any) {
    console.error("[azureAlarmMetadataServicesGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch alarm services" });
  }
}

export async function azureAlarmMetadataResourcesGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const service = req.query.service as string;
    const region = (req.query.region as string) || "all";
    if (!service) return res.status(400).json({ success: false, error: "Missing service parameter" });

    const inventory = await getResources(userId, region, tenantId, subscriptionId, clientId, clientSecret);

    let rawResources: any[] = [];
    let namespace = "";

    if (service === "ec2") { rawResources = inventory.ec2 || []; namespace = "Microsoft.Compute/virtualMachines"; }
    else if (service === "rds") { rawResources = inventory.rds || []; namespace = "Microsoft.Sql/servers/databases"; }
    else if (service === "s3") { rawResources = inventory.s3 || []; namespace = "Microsoft.Storage/storageAccounts"; }

    const resources = rawResources.map((r) => ({
      label: r.name || r.id?.split("/").pop() || "Unnamed Resource",
      value: r.id,
    }));

    res.json({ success: true, resources, dimensionKey: "resourceId", namespace });
  } catch (error: any) {
    console.error("[azureAlarmMetadataResourcesGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch alarm resources" });
  }
}

export async function azureAlarmMetadataActionGroupsGet(req: Request, res: Response) {
  try {
    const { tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const region = (req.query.region as string) || "all";
    const topics = await getAzureActionGroups(tenantId, subscriptionId, clientId, clientSecret, region);
    res.json({ success: true, topics });
  } catch (error: any) {
    console.error("[azureAlarmMetadataActionGroupsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch action groups" });
  }
}
