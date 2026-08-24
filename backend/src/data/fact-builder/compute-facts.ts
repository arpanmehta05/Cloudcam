import { Fact, getResourceMeta } from "./helpers";
import { calculateMetricStats } from "../../providers/aws/cloudwatch.provider";
import { SERVICE_REGISTRY } from "../service-registry";

const COMPUTE_SERVICES = new Set(["ec2", "ebs", "lambda", "ecs", "eks", "autoscaling", "amplify", "alerts"]);

export function buildComputeFacts(
  inventory: any,
  rawData: any,
  metricResults: any[],
  timeRange: string,
  startFactId: number,
  dataQuality: any,
): { facts: Fact[]; nextFactId: number } {
  const facts: Fact[] = [];
  let factId = startFactId;

  // 1. Process Inventory Facts
  if (inventory) {
    const computeInventoryMappings: Record<string, (items: any[]) => void> = {
      ec2: (items) =>
        items.forEach((inst: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `EC2 Instance "${inst.name || inst.id}" (${inst.id}, type: ${inst.type}, state: ${inst.state}, AZ: ${inst.az || "unknown"}). Public IP: ${inst.publicIp || "none"}.`,
            source: "EC2 DescribeInstances",
            resourceId: inst.id,
            resourceType: "ec2",
            region: inst.region,
          });
        }),
      lambda: (items) =>
        items.forEach((fn: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `Lambda Function "${fn.name}" (runtime: ${fn.runtime || "unknown"}, memory: ${fn.memory || "unknown"}MB, timeout: ${fn.timeout || "unknown"}s).`,
            source: "Lambda ListFunctions",
            resourceId: fn.name,
            resourceType: "lambda",
            region: fn.region,
          });
        }),
      ebs: (items) =>
        items.forEach((v: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `EBS Volume "${v.id}" (type: ${v.volumeType || "unknown"}, size: ${v.size || "unknown"}GB, state: ${v.state || "unknown"}, attached: ${v.attachedTo || "unattached"}).`,
            source: "EC2 DescribeVolumes",
            resourceId: v.id,
            resourceType: "ebs",
            region: v.region,
          });
        }),
      ecs: (items) =>
        items.forEach((s: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `ECS Service "${s.name || s.serviceName}" (cluster: ${s.cluster || "unknown"}, desired: ${s.desiredCount ?? "?"}, running: ${s.runningCount ?? "?"}).`,
            source: "ECS DescribeServices",
            resourceId: s.name || s.serviceName,
            resourceType: "ecs",
            region: s.region,
          });
        }),
      amplify: (items) =>
        items.forEach((a: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `Amplify App "${a.name}" (ID: ${a.id}, repo: ${a.repository || "none"}, domain: ${a.defaultDomain || "none"}).`,
            source: "Amplify ListApps",
            resourceId: a.id,
            resourceType: "amplify",
            region: a.region,
          });
        }),
    };

    for (const [svc, generator] of Object.entries(computeInventoryMappings)) {
      const items = inventory[svc];
      if (items && items.length > 0) {
        generator(items.slice(0, 5));
      }
    }
  }

  // 2. Process CloudWatch Metric Results for Compute services
  for (const result of metricResults) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const { serviceName, service, resourceId, results, metricError } =
      result.value as any;

    if (!COMPUTE_SERVICES.has(serviceName)) continue;

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

  return { facts, nextFactId: factId };
}
