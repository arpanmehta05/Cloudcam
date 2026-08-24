import { Request, Response } from "express";
import { getResources } from "../services/resources.service";
import { getAzureServiceMetrics } from "../services/metrics.service";
import { getAzureServiceLogs } from "../providers/logs.provider";
import { getBillingData } from "../services/billing.service";
import { getInsights as getAzureInsights } from "../services/insights.service";
import { getSecurityData as getAzureSecuritySummary } from "../services/security.service";
import { getCached, setCached, CacheTTL } from "../../../middleware/response-cache";
import { loadAzureCreds } from "./helper";

export async function azureResourcesGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    const region = (req.query.region as string) || "all";
    const forceRefresh = req.query.forceRefresh === "true";

    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const inventory = await getResources(userId, region, tenantId, subscriptionId, clientId, clientSecret, forceRefresh);
    const response = { success: true, inventory };
    setCached(userId, req, response, CacheTTL.RESOURCES);
    res.json(response);
  } catch (error: any) {
    console.error("[azureResourcesGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Azure resource inventory" });
  }
}

export async function azureMetricsGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    const service = req.query.service as string;
    const range = (req.query.range as string) || "24h";
    const region = (req.query.region as string) || "all";

    if (!service) return res.status(400).json({ success: false, error: "Missing service query parameter" });
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const forceRefresh = req.query.forceRefresh === "true" || req.headers["x-rabbittwatch-cache-bypass"] === "true";
    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const data = await getAzureServiceMetrics(userId, service, range, region, tenantId, subscriptionId, clientId, clientSecret, forceRefresh);
    const response = { success: true, ...data, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.METRICS);
    res.json(response);
  } catch (error: any) {
    console.error("[azureMetricsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Azure metrics" });
  }
}

export async function azureLogsGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    const service = req.query.service as string;
    const range = parseInt(req.query.range as string) || 3600;
    const region = req.query.region as string;
    const resourceId = req.query.resourceId as string;

    if (!service) return res.status(400).json({ success: false, error: "Missing service query parameter" });
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);

    const data = await getAzureServiceLogs(userId, service, range, region, tenantId, subscriptionId, clientId, clientSecret, resourceId);
    const response = { success: true, ...data, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.METRICS);
    res.json(response);
  } catch (error: any) {
    console.error("[azureLogsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Azure logs" });
  }
}

export async function azureBillingGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, billingAccountId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const forceRefresh = req.query.forceRefresh === "true" || req.headers["x-rabbittwatch-cache-bypass"] === "true";
    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const range = (req.query.range as string) || "24h";
    const billingData = await getBillingData(userId, range, tenantId, subscriptionId, clientId, clientSecret, billingAccountId, forceRefresh);
    const response = { success: true, ...billingData, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.BILLING);
    res.json(response);
  } catch (error: any) {
    console.error("[azureBillingGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Azure billing data" });
  }
}

export async function azureInsightsGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);

    const insightsData = await getAzureInsights(tenantId, subscriptionId, clientId, clientSecret);
    const response = { success: true, ...insightsData, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.INSIGHTS);
    res.json(response);
  } catch (error: any) {
    console.error("[azureInsightsGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Azure advisor insights" });
  }
}

export async function azureSecurityGet(req: Request, res: Response) {
  try {
    const { userId, tenantId, subscriptionId, clientId, clientSecret } = await loadAzureCreds(req);
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: "Azure integration not configured or connected" });
    }

    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);

    const securityData = await getAzureSecuritySummary(tenantId, subscriptionId, clientId, clientSecret);
    const response = { success: true, security: securityData, timestamp: new Date().toISOString() };
    setCached(userId, req, response, CacheTTL.SECURITY);
    res.json(response);
  } catch (error: any) {
    console.error("[azureSecurityGet] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Azure security summary" });
  }
}
