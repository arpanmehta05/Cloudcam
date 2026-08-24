import { Request, Response, NextFunction } from "express";
import {
  getCloudProviderDefinitions,
  isCloudProvider,
} from "../../../providers/cloud/registry";
import { CloudProvider } from "../../../models/aws.model";
import { getAggregateCloudResources } from "../services/resources.service";
import { getAllProviderConnectionSummaries } from "../services/capabilities.service";
import {
  getAggregateCloudBilling,
  getAggregateCloudInsights,
  getAggregateCloudLogs,
  getAggregateCloudMetrics,
  getAggregateCloudSecurity,
  getCloudRecommendationHub,
} from "../services/aggregate.service";

function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export function providersGet(_req: Request, res: Response): void {
  res.json({ success: true, providers: getCloudProviderDefinitions() });
}

export async function cloudConnectionsGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const providers = await getAllProviderConnectionSummaries(getUserId(req));
    res.json({ success: true, providers });
  } catch (error: any) {
    console.error("[cloudConnectionsGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud connections",
      });
  }
}

export async function cloudResourcesGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const providerParam = (req.query.provider as string) || "all";
    if (providerParam !== "all" && !isCloudProvider(providerParam)) {
      res
        .status(400)
        .json({ success: false, error: "Unsupported cloud provider" });
      return;
    }
    const region = (req.query.region as string) || "all";
    const forceRefresh =
      req.query.forceRefresh === "true" ||
      req.headers["x-rabbittwatch-cache-bypass"] === "true";
    const result = await getAggregateCloudResources(
      getUserId(req),
      providerParam as CloudProvider | "all",
      region,
      forceRefresh,
    );
    res.json(result);
  } catch (error: any) {
    console.error("[cloudResourcesGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud resources",
      });
  }
}

function parseProviderQuery(
  req: Request,
  res: Response,
): CloudProvider | "all" | null {
  const providerParam = (req.query.provider as string) || "all";
  if (providerParam !== "all" && !isCloudProvider(providerParam)) {
    res
      .status(400)
      .json({ success: false, error: "Unsupported cloud provider" });
    return null;
  }
  return providerParam as CloudProvider | "all";
}

export async function cloudMetricsGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const provider = parseProviderQuery(req, res);
    if (!provider) return;
    const service = (req.query.service as string) || "compute";
    const range = (req.query.range as string) || "24h";
    const region = (req.query.region as string) || "all";
    const forceRefresh =
      req.query.forceRefresh === "true" ||
      req.headers["x-rabbittwatch-cache-bypass"] === "true";
    res.json(
      await getAggregateCloudMetrics(
        getUserId(req),
        provider,
        service,
        range,
        region,
        forceRefresh,
      ),
    );
  } catch (error: any) {
    console.error("[cloudMetricsGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud metrics",
      });
  }
}

export async function cloudBillingGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const provider = parseProviderQuery(req, res);
    if (!provider) return;
    const range = (req.query.range as string) || "24h";
    const forceRefresh =
      req.query.forceRefresh === "true" ||
      req.headers["x-rabbittwatch-cache-bypass"] === "true";
    res.json(
      await getAggregateCloudBilling(
        getUserId(req),
        provider,
        range,
        forceRefresh,
      ),
    );
  } catch (error: any) {
    console.error("[cloudBillingGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud billing",
      });
  }
}

export async function cloudSecurityGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const provider = parseProviderQuery(req, res);
    if (!provider) return;
    const region = (req.query.region as string) || "all";
    res.json(await getAggregateCloudSecurity(getUserId(req), provider, region));
  } catch (error: any) {
    console.error("[cloudSecurityGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud security",
      });
  }
}

export async function cloudInsightsGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const provider = parseProviderQuery(req, res);
    if (!provider) return;
    const region = (req.query.region as string) || "all";
    res.json(await getAggregateCloudInsights(getUserId(req), provider, region));
  } catch (error: any) {
    console.error("[cloudInsightsGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud insights",
      });
  }
}

export async function cloudRecommendationsGet(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const provider = parseProviderQuery(req, res);
    if (!provider) return;
    const region = (req.query.region as string) || "all";
    const forceRefresh =
      req.query.forceRefresh === "true" ||
      req.headers["x-rabbittwatch-cache-bypass"] === "true";
    res.json(
      await getCloudRecommendationHub(
        getUserId(req),
        provider,
        region,
        forceRefresh,
      ),
    );
  } catch (error: any) {
    console.error("[cloudRecommendationsGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud recommendations",
      });
  }
}

export async function cloudLogsGet(req: Request, res: Response): Promise<void> {
  try {
    const provider = parseProviderQuery(req, res);
    if (!provider) return;
    const service = (req.query.service as string) || "compute";
    const range = Number.parseInt((req.query.range as string) || "3600", 10);
    const region = (req.query.region as string) || "all";
    res.json(
      await getAggregateCloudLogs(
        getUserId(req),
        provider,
        service,
        Number.isFinite(range) ? range : 3600,
        region,
      ),
    );
  } catch (error: any) {
    console.error("[cloudLogsGet] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load cloud logs",
      });
  }
}

export function requireAwsProvider(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const provider = Array.isArray(req.params.provider)
    ? req.params.provider[0]
    : req.params.provider;
  if (!isCloudProvider(provider)) {
    res
      .status(400)
      .json({ success: false, error: "Unsupported cloud provider" });
    return;
  }
  if (provider !== "aws") {
    res.status(501).json({
      success: false,
      error: `${provider} endpoints are planned for the next phase. AWS remains available through this cloud route.`,
    });
    return;
  }
  next();
}

export function requireSupportedProvider(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const provider = Array.isArray(req.params.provider)
    ? req.params.provider[0]
    : req.params.provider;
  if (!isCloudProvider(provider)) {
    res
      .status(400)
      .json({ success: false, error: "Unsupported cloud provider" });
    return;
  }
  if (provider !== "aws" && provider !== "azure" && provider !== "gcp") {
    res.status(501).json({
      success: false,
      error: `${provider} endpoints are planned for the next phase.`,
    });
    return;
  }
  next();
}
