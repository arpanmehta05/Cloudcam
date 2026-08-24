import { Request, Response } from "express";
import { getResources } from "../services/resources.service";
import { getGcpServiceMetrics } from "../services/metrics.service";
import { getGcpServiceLogs } from "../providers/logs.provider";
import { getGcpBillingData } from "../services/billing.service";
import { getSecurityData as getGcpSecuritySummary } from "../services/security.service";
import { getInsights as getGcpInsights } from "../services/insights.service";
import { getCached, setCached, CacheTTL } from "../../../middleware/response-cache";
import { loadGcpCreds, getUserId } from "./helper";

export async function gcpResourcesGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    const region = (req.query.region as string) || "all";
    const forceRefresh = req.query.forceRefresh === "true";

    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }

    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const inventory = await getResources(userId, region, projectId, clientEmail, privateKey, forceRefresh);
    const response = { success: true, inventory };
    setCached(userId, req, response, CacheTTL.RESOURCES);
    res.json(response);
  } catch (error: any) {
    console.error("[gcpResourcesGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch GCP resource inventory" });
  }
}

export async function gcpMetricsGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    const service = req.query.service as string;
    const range = (req.query.range as string) || "24h";
    const region = (req.query.region as string) || "all";

    if (!service) return res.status(400).json({ success: false, error: "Missing service query parameter" });
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }

    const forceRefresh = req.query.forceRefresh === "true" || req.headers["x-rabbittwatch-cache-bypass"] === "true";
    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const data = await getGcpServiceMetrics(userId, service, range, region, projectId, clientEmail, privateKey, forceRefresh);
    const response = { success: true, ...data, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.METRICS);
    res.json(response);
  } catch (error: any) {
    console.error("[gcpMetricsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch GCP metrics" });
  }
}

export async function gcpLogsGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    const service = req.query.service as string;
    const range = parseInt(req.query.range as string) || 3600;
    const region = req.query.region as string;
    const resourceId = req.query.resourceId as string;

    if (!service) return res.status(400).json({ success: false, error: "Missing service query parameter" });
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }

    const forceRefresh = req.query.forceRefresh === "true" || req.headers["x-rabbittwatch-cache-bypass"] === "true";
    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const data = await getGcpServiceLogs(projectId, service, range, region, clientEmail, privateKey, resourceId);
    const response = { success: true, ...data, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.METRICS);
    res.json(response);
  } catch (error: any) {
    console.error("[gcpLogsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch GCP logs" });
  }
}

export async function gcpBillingGet(req: Request, res: Response) {
  try {
    const { userId, projectId, clientEmail, privateKey, billingDatasetId, billingTableId } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }

    const forceRefresh = req.query.forceRefresh === "true" || req.headers["x-rabbittwatch-cache-bypass"] === "true";
    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const range = (req.query.range as string) || "24h";
    const billingData = await getGcpBillingData(userId, range, projectId, clientEmail, privateKey, billingDatasetId, billingTableId);
    const response = { success: true, ...billingData, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.BILLING);
    res.json(response);
  } catch (error: any) {
    console.error("[gcpBillingGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch GCP billing data" });
  }
}

export async function gcpInsightsGet(req: Request, res: Response) {
  try {
    const { projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }

    const cached = getCached(getUserId(req), req);
    if (cached) return res.json(cached.data);

    const insightsData = await getGcpInsights(projectId, clientEmail, privateKey);
    const response = { success: true, ...insightsData, timestamp: new Date().toISOString() };
    setCached(getUserId(req), req, response, CacheTTL.INSIGHTS);
    res.json(response);
  } catch (error: any) {
    console.error("[gcpInsightsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch GCP insights" });
  }
}

export async function gcpSecurityGet(req: Request, res: Response) {
  try {
    const { projectId, clientEmail, privateKey } = await loadGcpCreds(req);
    if (!projectId || !clientEmail || !privateKey) {
      return res.status(400).json({ success: false, error: "GCP integration not configured or connected" });
    }

    const cached = getCached(getUserId(req), req);
    if (cached) return res.json(cached.data);

    const securityData = await getGcpSecuritySummary(projectId, clientEmail, privateKey);
    const response = { success: true, security: securityData, timestamp: new Date().toISOString() };
    setCached(getUserId(req), req, response, CacheTTL.SECURITY);
    res.json(response);
  } catch (error: any) {
    console.error("[gcpSecurityGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch GCP security summary" });
  }
}
