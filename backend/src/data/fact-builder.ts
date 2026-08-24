import { logger } from "../core/logger";
import { SERVICE_REGISTRY } from "./service-registry";
import { fetchMetrics } from "../providers/aws/cloudwatch.provider";
import { CloudWatchMetricQuery } from "../models/metrics.model";
import { getMonthToDateCost, getCostForecast } from "../providers/aws/cost-explorer.provider";
import { getResourceInventory } from "../providers/aws/resources.provider";
import { getSecuritySummary } from "../providers/aws/security.provider";
import { getVpsLogSummary } from "../services/vps-logs.service";
import type { ParsedIntent } from "../models/chat.model";
import { selectProductKnowledge } from "./product-knowledge";

import {
  Fact,
  FactSheetResult,
  buildDimensionFilters,
  timeRangeToHours,
} from "./fact-builder/helpers";

import { buildComputeFacts } from "./fact-builder/compute-facts";
import { buildDatabaseFacts } from "./fact-builder/database-facts";
import { buildNetworkFacts } from "./fact-builder/network-facts";
import { buildBillingFacts } from "./fact-builder/billing-facts";

export type { Fact, FactSheetResult };

const factSheetCache = new Map<string, { data: FactSheetResult; expiresAt: number }>();
const FACT_SHEET_TTL_MS = 10 * 60 * 1000; // 10 minutes

const RECOMMENDATION_SERVICES = new Set([
  "ec2", "ebs", "lambda", "rds", "s3", "dynamodb", "ecs", "elasticache", "redshift", "alb", "sqs", "eks", "autoscaling",
]);

function makeFactCacheKey(workspaceId: string, intent: ParsedIntent, message?: string): string {
  const services = [...intent.services].sort().join(",");
  const queryScope = intent.intent === "product_help"
    ? `:${(message || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80)}`
    : "";
  return `fact:${workspaceId}:${intent.intent}:${intent.timeRange}:${services}${queryScope}`;
}

export async function buildFactSheet(
  intent: ParsedIntent,
  workspaceId: string,
  roleArn?: string,
  externalId?: string,
  message?: string,
): Promise<FactSheetResult> {
  const { timeRange } = intent;
  const cacheKey = makeFactCacheKey(workspaceId, intent, message);
  const cached = factSheetCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    logger.info(`[FactBuilder] Cache HIT (${cached.data.facts.length} facts)`);
    return cached.data;
  }

  const facts: Fact[] = [];
  const rawData: Record<string, any> = {};
  let factId = 1;

  const { services, dataSources } = intent;
  const startTime = Date.now();
  const dataQuality: FactSheetResult["dataQuality"] = {
    fetchedAt: new Date().toISOString(),
    complete: true,
    sourceStatuses: {
      inventory: "ok",
      metrics: "ok",
      billing: "skipped",
      security: "skipped",
      vpsLogs: "skipped",
      productKnowledge: "skipped",
    },
    failedSources: [],
  };

  const productKnowledge = selectProductKnowledge(
    `${intent.intent} ${intent.services.join(" ")} ${message || ""}`,
    intent.services,
    intent.intent === "product_help" ? 14 : 6,
  );
  const shouldUseProductKnowledge =
    intent.intent === "product_help" ||
    intent.services.some((s) => ["product", "docs", "simulation", "ai_observability", "live_infrastructure"].includes(s)) ||
    productKnowledge.length > 0;

  if (shouldUseProductKnowledge) {
    const selectedKnowledge = productKnowledge.length > 0
      ? productKnowledge
      : selectProductKnowledge("cloudwatcher product help", ["product"], 6);
    dataQuality.sourceStatuses.productKnowledge = "ok";
    for (const item of selectedKnowledge) {
      facts.push({
        id: `FACT-${factId++}`,
        type: "knowledge",
        content: `${item.title}: ${item.content}`,
        source: item.source,
        resourceType: item.topic,
      });
    }
  }

  if (intent.intent === "product_help" &&
      !intent.services.some((s) => !["product", "docs", "simulation", "ai_observability", "live_infrastructure"].includes(s)) &&
      !intent.dataSources.metrics && !intent.dataSources.logs && !intent.dataSources.costExplorer) {
    dataQuality.sourceStatuses.inventory = "skipped";
    dataQuality.sourceStatuses.metrics = "skipped";
    const factSheet = facts.map((f) => `[${f.id}] ${f.content} | Source: ${f.source}`).join("\n");
    const result: FactSheetResult = { facts, factSheet, rawData, dataQuality };
    factSheetCache.set(cacheKey, { data: result, expiresAt: Date.now() + FACT_SHEET_TTL_MS });
    return result;
  }

  const needsBilling = dataSources.costExplorer || services.includes("cost") || ["cost_optimization", "architecture_review", "capacity_planning"].includes(intent.intent);
  const needsSecurity = services.includes("security") || ["resource_health", "security_audit", "compliance_check", "architecture_review"].includes(intent.intent);
  const needsVpsLogs = dataSources.logs || ["debugging", "performance_tuning", "resource_health", "security_audit"].includes(intent.intent);

  let inventory: any = null;
  try {
    inventory = await getResourceInventory(workspaceId, undefined, roleArn, externalId);
    rawData["inventory"] = inventory;
  } catch (err) {
    logger.error("[FactBuilder] Inventory fetch failed:", err);
    dataQuality.sourceStatuses.inventory = "failed";
    dataQuality.failedSources.push("inventory");
  }

  const servicesToQuery = new Set<string>();
  if (inventory) {
    for (const [key, items] of Object.entries(inventory)) {
      if (Array.isArray(items) && items.length > 0 && RECOMMENDATION_SERVICES.has(key) && SERVICE_REGISTRY[key]?.metrics.length > 0) {
        servicesToQuery.add(key);
      }
    }
  } else {
    servicesToQuery.add("ec2");
    servicesToQuery.add("lambda");
  }

  const metricJobs: any[] = [];
  for (const serviceName of Array.from(servicesToQuery)) {
    const service = SERVICE_REGISTRY[serviceName];
    if (!service || service.metrics.length === 0) continue;

    const dimensionSets = buildDimensionFilters(serviceName, intent.extractedEntities, inventory);
    if (dimensionSets.length > 0) {
      for (const ds of dimensionSets) {
        const dims = ds.dimensions;
        const resourceId = dims[0]?.Value || null;
        const queries: CloudWatchMetricQuery[] = service.metrics.map((m: any) => ({
          namespace: m.namespace, metricName: m.metricName, stat: m.stat, period: m.period,
          dimensions: dims.map((d) => ({ Name: d.Name, Value: d.Value })),
        }));
        metricJobs.push({ serviceName, service, resourceId, queries, region: ds.region });
      }
    } else {
      const queries: CloudWatchMetricQuery[] = service.metrics.map((m: any) => ({
        namespace: m.namespace, metricName: m.metricName, stat: m.stat, period: m.period, dimensions: [],
      }));
      metricJobs.push({ serviceName, service, resourceId: null, queries });
    }
  }

  logger.info(`[FactBuilder] Metric jobs: ${metricJobs.length}`);

  const [billingResults, securityResult, vpsLogsResult, ...metricResults] = await Promise.allSettled([
    needsBilling ? Promise.all([getMonthToDateCost(workspaceId, roleArn, externalId), getCostForecast(workspaceId, roleArn, externalId)]) : Promise.resolve(null),
    needsSecurity ? getSecuritySummary(workspaceId, undefined, roleArn, externalId) : Promise.resolve(null),
    needsVpsLogs ? getVpsLogSummary(workspaceId, { hours: timeRangeToHours(timeRange) }) : Promise.resolve(null),
    ...metricJobs.map((job) => fetchMetrics(workspaceId, job.queries, timeRange, job.region, roleArn, externalId)
      .then((results) => ({ ...job, results }))
      .catch((error) => ({ ...job, results: [], metricError: error instanceof Error ? error.message : String(error) }))),
  ]);

  if (needsBilling) dataQuality.sourceStatuses.billing = billingResults.status === "fulfilled" ? "ok" : "failed";
  if (needsSecurity) dataQuality.sourceStatuses.security = securityResult.status === "fulfilled" ? "ok" : "failed";
  if (needsVpsLogs) dataQuality.sourceStatuses.vpsLogs = vpsLogsResult.status === "fulfilled" ? "ok" : "failed";

  if (inventory) {
    facts.push({
      id: `FACT-${factId++}`, type: "inventory",
      content: `Infrastructure Scan: ${inventory.counts.total} active resources (${inventory.counts.ec2 || 0} EC2, ${inventory.counts.lambda || 0} Lambda, ${inventory.counts.rds || 0} RDS, ${inventory.counts.s3 || 0} S3, ${inventory.counts.ebs || 0} EBS, ${inventory.counts.dynamodb || 0} DynamoDB, ${inventory.counts.ecs || 0} ECS, ${inventory.counts.amplify || 0} Amplify, ${inventory.counts.sqs || 0} SQS, ${inventory.counts.alb || 0} ALB).`,
      source: "AWS SDK Resource Discovery", value: inventory.counts.total, unit: "resources",
    });
  }

  // 1. Compute Domain
  const computeRes = buildComputeFacts(inventory, rawData, metricResults, timeRange, factId, dataQuality);
  facts.push(...computeRes.facts);
  factId = computeRes.nextFactId;

  // 2. Database Domain
  const databaseRes = buildDatabaseFacts(inventory, rawData, metricResults, timeRange, factId, dataQuality);
  facts.push(...databaseRes.facts);
  factId = databaseRes.nextFactId;

  // 3. Network & Security Domain
  const networkRes = buildNetworkFacts(inventory, rawData, metricResults, timeRange, factId, dataQuality, securityResult, vpsLogsResult, needsSecurity, needsVpsLogs);
  facts.push(...networkRes.facts);
  factId = networkRes.nextFactId;

  // 4. Billing Domain
  const billingRes = buildBillingFacts(inventory, rawData, billingResults, factId, needsBilling);
  facts.push(...billingRes.facts);
  factId = billingRes.nextFactId;

  if (metricJobs.length > 0) {
    const fulfilledMetricJobs = metricResults.filter((r) => r.status === "fulfilled").length;
    dataQuality.sourceStatuses.metrics = fulfilledMetricJobs === 0 ? "failed" : (fulfilledMetricJobs < metricJobs.length ? "partial" : "ok");
  } else {
    dataQuality.sourceStatuses.metrics = "skipped";
  }

  const elapsed = Date.now() - startTime;
  logger.info(`[FactBuilder] Built ${facts.length} facts in ${elapsed}ms`);

  const MAX_FACTS = 80;
  if (facts.length > MAX_FACTS) {
    const priority: Record<string, number> = { calculated: 0, knowledge: 1, billing: 2, security: 3, log: 4, metric: 5, inventory: 6 };
    facts.sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99));
    facts.splice(MAX_FACTS);
  }

  dataQuality.complete = dataQuality.failedSources.length === 0 && dataQuality.sourceStatuses.inventory !== "failed" && dataQuality.sourceStatuses.metrics !== "failed";
  const factSheet = facts.map((f) => {
    let line = `[${f.id}] ${f.content} | Source: ${f.source}`;
    if (f.resourceId) line += ` | Resource: ${f.resourceId}`;
    if (f.region) line += ` | Region: ${f.region}`;
    return line;
  }).join("\n");

  const result: FactSheetResult = { facts, factSheet, rawData, dataQuality };
  factSheetCache.set(cacheKey, { data: result, expiresAt: Date.now() + FACT_SHEET_TTL_MS });
  return result;
}

export function validateCitations(responseCitations: string[], availableFacts: Fact[]): { valid: boolean; missing: string[]; found: string[] } {
  const availableIds = new Set(availableFacts.map((f) => f.id));
  const found: string[] = [];
  const missing: string[] = [];
  for (const cite of responseCitations) {
    const normalized = cite.toUpperCase().replace(/[\[\]]/g, "").trim();
    if (availableIds.has(normalized) || availableIds.has(`FACT-${normalized.replace("FACT-", "")}`)) {
      found.push(normalized);
    } else {
      missing.push(cite);
    }
  }
  return { valid: missing.length === 0, missing, found };
}

export function extractCitations(text: string): string[] {
  const matches = text.match(/\[FACT-[\d,\s]+\]/gi) || [];
  const ids: string[] = [];
  matches.forEach((m) => {
    const parts = m.replace(/[\[\]]/g, "").split(",");
    parts.forEach((p) => {
      const clean = p.trim().toUpperCase();
      if (clean.startsWith("FACT-")) ids.push(clean);
      else if (/^\d+$/.test(clean)) ids.push(`FACT-${clean}`);
    });
  });
  return [...new Set(ids)];
}

export function extractResourceIds(text: string): string[] {
  const patterns = [/i-[0-9a-f]{8,17}/gi, /vol-[0-9a-f]{8,17}/gi, /arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:[^\s"]+/gi, /db-[A-Z0-9]{26}/gi];
  const ids: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    ids.push(...matches);
  }
  return [...new Set(ids)];
}
