import { Fact, getResourceMeta, timeRangeToHours } from "./helpers";
import { calculateMetricStats } from "../../providers/aws/cloudwatch.provider";
import { SERVICE_REGISTRY } from "../service-registry";

const NETWORK_SECURITY_SERVICES = new Set([
  "alb",
  "cloudfront",
  "waf",
  "kinesis",
  "sqs",
  "sns",
  "eventbridge",
  "networking",
  "security",
  "eip",
  "sg",
  "tg",
]);

export function buildNetworkFacts(
  inventory: any,
  rawData: any,
  metricResults: any[],
  timeRange: string,
  startFactId: number,
  dataQuality: any,
  securityResult: any,
  vpsLogsResult: any,
  needsSecurity: boolean,
  needsVpsLogs: boolean,
): { facts: Fact[]; nextFactId: number } {
  const facts: Fact[] = [];
  let factId = startFactId;

  // 1. Process Inventory Facts
  if (inventory) {
    const networkInventoryMappings: Record<string, (items: any[]) => void> = {
      sqs: (items) =>
        items.forEach((q: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `SQS Queue "${q.name}".`,
            source: "SQS ListQueues",
            resourceId: q.name,
            resourceType: "sqs",
            region: q.region,
          });
        }),
      alb: (items) =>
        items.forEach((l: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `ALB "${l.name}" (scheme: ${l.scheme || "unknown"}, VPC: ${l.vpcId || "unknown"}).`,
            source: "ELBv2 DescribeLoadBalancers",
            resourceId: l.name,
            resourceType: "alb",
            region: l.region,
          });
        }),
    };

    for (const [svc, generator] of Object.entries(networkInventoryMappings)) {
      const items = inventory[svc];
      if (items && items.length > 0) {
        generator(items.slice(0, 5));
      }
    }
  }

  // 2. Process CloudWatch Metric Results
  for (const result of metricResults) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const { serviceName, service, resourceId, results, metricError } =
      result.value as any;

    if (!NETWORK_SECURITY_SERVICES.has(serviceName)) continue;

    if (metricError) {
      if (dataQuality.sourceStatuses.metrics === "ok") {
        dataQuality.sourceStatuses.metrics = "partial";
      }
      dataQuality.failedSources.push(`metrics:${serviceName}`);
    }

    const meta = resourceId
      ? getResourceMeta(serviceName, resourceId, inventory)
      : null;
    const resourceLabel = meta
      ? `"${meta.name}" (${resourceId}${meta.details ? ", " + meta.details : ""})`
      : service.displayName;

    results.forEach((series: any, idx: number) => {
      const metricDef = service.metrics[idx];
      if (!metricDef) return;
      const stats = calculateMetricStats(series.datapoints);
      const rawKey = resourceId
        ? `${serviceName}_${resourceId}_${metricDef.name}`
        : `${serviceName}_${metricDef.name}`;
      rawData[rawKey] = stats;

      facts.push({
        id: `FACT-${factId++}`,
        type: "metric",
        content: resourceId
          ? `${service.displayName} ${resourceLabel} -- ${metricDef.name}: current ${stats.current.toFixed(1)}${metricDef.unit}, ${timeRange} avg ${stats.avg.toFixed(1)}${metricDef.unit} (min: ${stats.min.toFixed(1)}, max: ${stats.max.toFixed(1)}${metricDef.unit}, trend: ${stats.trend || "stable"}).`
          : `${service.displayName} ${metricDef.name} (aggregate): current ${stats.current.toFixed(1)}${metricDef.unit}, ${timeRange} avg ${stats.avg.toFixed(1)}${metricDef.unit} (max: ${stats.max.toFixed(1)}${metricDef.unit}).`,
        source: `CloudWatch ${metricDef.namespace}/${metricDef.metricName}`,
        value: stats.current,
        unit: metricDef.unit,
        resourceId: resourceId || undefined,
        resourceType: resourceId ? serviceName : undefined,
      });
    });
  }

  // 3. Process Security Results
  if (needsSecurity && securityResult.status === "fulfilled" && securityResult.value) {
    const security = securityResult.value as any;
    rawData["security"] = security;
    if (security.threats.status?.includes("Access Denied")) {
      facts.push({
        id: `FACT-${factId++}`,
        type: "security",
        content:
          "GuardDuty: Access Denied -- IAM role lacks guardduty permissions.",
        source: "AWS IAM",
      });
    } else if (security.threats.count > 0) {
      facts.push({
        id: `FACT-${factId++}`,
        type: "security",
        content: `GuardDuty: ${security.threats.count} active threats. Max severity: ${security.threats.maxSeverity?.toFixed?.(1) || security.threats.maxSeverity || "unknown"}.`,
        source: "AWS GuardDuty",
        value: security.threats.count,
      });
    } else {
      facts.push({
        id: `FACT-${factId++}`,
        type: "security",
        content: "GuardDuty: No active threats.",
        source: "AWS GuardDuty",
      });
    }
    if (security.compliance.providerStatus?.includes("Access Denied")) {
      facts.push({
        id: `FACT-${factId++}`,
        type: "security",
        content: "SecurityHub: Access Denied.",
        source: "AWS IAM",
      });
    } else if (security.compliance.highRiskFindings > 0) {
      facts.push({
        id: `FACT-${factId++}`,
        type: "security",
        content: `SecurityHub: ${security.compliance.highRiskFindings} HIGH/CRITICAL findings.`,
        source: "AWS SecurityHub",
        value: security.compliance.highRiskFindings,
      });
    }
    if (security.iam.mfaStatus.includes("Access Denied")) {
      facts.push({
        id: `FACT-${factId++}`,
        type: "security",
        content: "IAM: Access Denied for credential report.",
        source: "AWS IAM",
      });
    } else {
      facts.push({
        id: `FACT-${factId++}`,
        type: "security",
        content: `IAM MFA status: "${security.iam.mfaStatus}".`,
        source: "AWS IAM",
      });
    }
  }

  // 4. Process VPS Logs
  if (needsVpsLogs && vpsLogsResult.status === "fulfilled" && vpsLogsResult.value) {
    const vpsSummary = vpsLogsResult.value as any;
    rawData["vpsLogs"] = vpsSummary;

    const windowHours = Number(
      vpsSummary?.windowHours || timeRangeToHours(timeRange),
    );
    const totalLogs = Number(vpsSummary?.totals?.logs || 0);
    const totalErrors = Number(vpsSummary?.totals?.errors || 0);
    const totalWarnings = Number(vpsSummary?.totals?.warnings || 0);

    facts.push({
      id: `FACT-${factId++}`,
      type: "log",
      content: `VPS logs (${windowHours}h): ${totalLogs} total entries, ${totalErrors} errors, ${totalWarnings} warnings.`,
      source: "VPS Log Ingestion",
      value: totalErrors,
      unit: "errors",
    });

    const topErrors = Array.isArray(vpsSummary?.topErrors)
      ? vpsSummary.topErrors.slice(0, 5)
      : [];
    topErrors.forEach((entry: any) => {
      facts.push({
        id: `FACT-${factId++}`,
        type: "log",
        content: `VPS top error: service=${entry?.service || "unknown"}, signature=${entry?.signature || "unknown"}, count=${Number(entry?.count || 0)}, sample=\"${String(entry?.sample || "n/a")}\".`,
        source: "VPS Log Summary",
        value: Number(entry?.count || 0),
        unit: "count",
      });
    });

    const serviceHotspots = Array.isArray(vpsSummary?.services)
      ? vpsSummary.services.slice(0, 3)
      : [];
    serviceHotspots.forEach((serviceEntry: any) => {
      facts.push({
        id: `FACT-${factId++}`,
        type: "log",
        content: `VPS log volume hotspot: service=${serviceEntry?.service || "unknown"}, entries=${Number(serviceEntry?.count || 0)} in ${windowHours}h.`,
        source: "VPS Log Summary",
        value: Number(serviceEntry?.count || 0),
        unit: "entries",
      });
    });
  }

  return { facts, nextFactId: factId };
}
