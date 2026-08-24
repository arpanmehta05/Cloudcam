import { Request, Response } from "express";
import { ActionRequest, AuditLog } from "../../../models/action.model";
import {
  getGcpAlertRules,
  putGcpMetricAlert,
  toggleGcpAlertRule,
  deleteGcpAlertRule,
  getGcpNotificationChannels,
} from "../providers/alerts.provider";
import {
  provisionDefaultAlarms,
  previewDefaultAlarms,
} from "../services/default-alarms.service";
import { getCached, setCached, invalidatePattern, CacheTTL } from "../../../middleware/response-cache";
import { getResources } from "../services/resources.service";
import { SERVICE_REGISTRY } from "../../../data/service-registry";
import { loadGcpCreds } from "./helper";

export async function gcpAlarmsGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const region = (req.query.region as string) || "all";
    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);
    const data = await getGcpAlertRules(projectId, clientEmail, privateKey, region);
    const response = { success: true, ...data };
    setCached(userId, req, response, CacheTTL.ALARMS);
    res.json(response);
  } catch (error: any) {
    console.error("[gcpAlarmsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch GCP alerts" });
  }
}

export async function gcpAlarmsPost(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const { region, alarm } = req.body;
    if (!region || !alarm || !alarm.name || !alarm.resourceId) {
      return res.status(400).json({ success: false, error: "Missing required alarm parameters" });
    }
    const result = await putGcpMetricAlert(projectId, clientEmail, privateKey, region, alarm.name, {
      name: alarm.name, metric: alarm.metric, threshold: alarm.threshold,
      comparison: alarm.comparison, period: alarm.period, evaluationPeriods: alarm.evaluationPeriods,
      resourceId: alarm.resourceId, actions: alarm.actions,
    });
    const actionReq = await ActionRequest.create({
      userId, actionId: "gcp-alarm-create", displayName: `Create GCP Alert Rule: ${alarm.name}`, service: "gcp-alarms",
      targets: [{ resourceId: alarm.resourceId, resourceName: alarm.name, region: region || "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: true, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "gcp-alarm-create", requestId: actionReq._id.toString(),
      targets: [alarm.resourceId], changes: [{ alarmName: alarm.name, metric: alarm.metric, threshold: alarm.threshold }], timestamp: new Date(),
    });
    invalidatePattern(userId, "/gcp/alarms");
    res.json(result);
  } catch (error: any) {
    console.error("[gcpAlarmsPost] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create GCP metric alert" });
  }
}

export async function gcpAlarmDelete(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const alarmName = req.query.alarmName as string;
    if (!alarmName) return res.status(400).json({ success: false, error: "Missing alarmName parameter" });
    const result = await deleteGcpAlertRule(projectId, clientEmail, privateKey, alarmName);
    const actionReq = await ActionRequest.create({
      userId, actionId: "gcp-alarm-delete", displayName: `Delete GCP Alert Rule: ${alarmName}`, service: "gcp-alarms",
      targets: [{ resourceId: alarmName, resourceName: alarmName, region: "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: false, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "gcp-alarm-delete", requestId: actionReq._id.toString(),
      targets: [alarmName], changes: [{ alarmDeleted: alarmName }], timestamp: new Date(),
    });
    invalidatePattern(userId, "/gcp/alarms");
    res.json(result);
  } catch (error: any) {
    console.error("[gcpAlarmDelete] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete GCP alert rule" });
  }
}

export async function gcpAlarmTogglePatch(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const name = req.params.name as string;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ success: false, error: "Missing or invalid enabled flag" });
    const result = await toggleGcpAlertRule(projectId, clientEmail, privateKey, name, enabled);
    const actionReq = await ActionRequest.create({
      userId, actionId: "gcp-alarm-toggle", displayName: `${enabled ? "Enable" : "Disable"} GCP Alert Rule: ${name}`, service: "gcp-alarms",
      targets: [{ resourceId: name, resourceName: name, region: "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: true, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "gcp-alarm-toggle", requestId: actionReq._id.toString(),
      targets: [name], changes: [{ alarmToggled: name, enabled }], timestamp: new Date(),
    });
    invalidatePattern(userId, "/gcp/alarms");
    res.json(result);
  } catch (error: any) {
    console.error("[gcpAlarmTogglePatch] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to toggle GCP alert rule" });
  }
}

export async function gcpDefaultAlarmsGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const result = await previewDefaultAlarms(userId, projectId, clientEmail, privateKey);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[gcpDefaultAlarmsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to preview default alarms" });
  }
}

export async function gcpDefaultAlarmsPost(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const { alarmActions } = req.body;
    const result = await provisionDefaultAlarms(userId, projectId, clientEmail, privateKey, alarmActions);
    const actionReq = await ActionRequest.create({
      userId, actionId: "gcp-alarms-provision", displayName: "Provision GCP default alert rules", service: "gcp-alarms",
      targets: [{ resourceId: projectId, resourceName: `Project: ${projectId}`, region: "global", status: "completed" }],
      status: "completed", riskLevel: "low", reversible: false, estimatedSavings: 0, simulationMode: false, completedAt: new Date(),
    });
    await AuditLog.create({
      event: "executed", userId, actionId: "gcp-alarms-provision", requestId: actionReq._id.toString(),
      targets: [projectId], changes: [{ provisionedCount: result.created }], timestamp: new Date(),
    });
    invalidatePattern(userId, "/gcp/alarms");
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[gcpDefaultAlarmsPost] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to provision default alarms" });
  }
}

export async function gcpAlarmMetadataServicesGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const region = (req.query.region as string) || "all";
    const inventory = await getResources(userId, region, projectId, clientEmail, privateKey);
    const metadataServices = [
      { key: "ec2", label: "Compute Engine Instances", namespace: "compute.googleapis.com/instance", dimensionKey: "instance_id", hasResources: (inventory.ec2 || []).length > 0, resourceCount: (inventory.ec2 || []).length, metrics: SERVICE_REGISTRY["ec2"]?.metrics || [] },
      { key: "rds", label: "Cloud SQL Databases", namespace: "cloudsql.googleapis.com/database", dimensionKey: "database_id", hasResources: (inventory.rds || []).length > 0, resourceCount: (inventory.rds || []).length, metrics: SERVICE_REGISTRY["rds"]?.metrics || [] },
      { key: "s3", label: "Cloud Storage Buckets", namespace: "storage.googleapis.com/storage", dimensionKey: "bucket_name", hasResources: (inventory.s3 || []).length > 0, resourceCount: (inventory.s3 || []).length, metrics: SERVICE_REGISTRY["s3"]?.metrics || [] },
    ];
    res.json({ success: true, services: metadataServices });
  } catch (error: any) {
    console.error("[gcpAlarmMetadataServicesGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch alarm services" });
  }
}

export async function gcpAlarmMetadataResourcesGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const service = req.query.service as string;
    const region = (req.query.region as string) || "all";
    if (!service) return res.status(400).json({ success: false, error: "Missing service parameter" });
    const inventory = await getResources(userId, region, projectId, clientEmail, privateKey);

    let rawResources: any[] = [];
    let namespace = "";
    if (service === "ec2") { rawResources = inventory.ec2 || []; namespace = "compute.googleapis.com/instance"; }
    else if (service === "rds") { rawResources = inventory.rds || []; namespace = "cloudsql.googleapis.com/database"; }
    else if (service === "s3") { rawResources = inventory.s3 || []; namespace = "storage.googleapis.com/storage"; }

    const resources = rawResources.map(r => ({ label: r.name || r.id?.split("/").pop() || "Unnamed Resource", value: r.id }));
    res.json({
      success: true, resources,
      dimensionKey: service === "ec2" ? "instance_id" : service === "rds" ? "database_id" : "bucket_name",
      namespace,
    });
  } catch (error: any) {
    console.error("[gcpAlarmMetadataResourcesGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch alarm resources" });
  }
}

export async function gcpAlarmMetadataActionGroupsGet(req: Request, res: Response) {
  try {
    const { projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }
    const region = (req.query.region as string) || "all";
    const topics = await getGcpNotificationChannels(projectId, clientEmail, privateKey, region);
    res.json({ success: true, topics });
  } catch (error: any) {
    console.error("[gcpAlarmMetadataActionGroupsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch notification channels" });
  }
}
