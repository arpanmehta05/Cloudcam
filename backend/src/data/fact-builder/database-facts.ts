import { Fact, getResourceMeta } from "./helpers";
import { calculateMetricStats } from "../../providers/aws/cloudwatch.provider";
import { SERVICE_REGISTRY } from "../service-registry";

const DATABASE_STORAGE_SERVICES = new Set([
  "rds",
  "s3",
  "dynamodb",
  "elasticache",
  "redshift",
  "efs",
  "ecr",
  "ecr_image",
]);

export function buildDatabaseFacts(
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
    const databaseInventoryMappings: Record<string, (items: any[]) => void> = {
      rds: (items) =>
        items.forEach((db: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `RDS Database "${db.id}" (engine: ${db.engine || "unknown"}, class: ${db.instanceClass || "unknown"}, storage: ${db.storage || "unknown"}GB, multiAZ: ${db.multiAZ || false}, status: ${db.status || "unknown"}).`,
            source: "RDS DescribeDBInstances",
            resourceId: db.id,
            resourceType: "rds",
            region: db.region,
          });
        }),
      s3: (items) =>
        items.forEach((b: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `S3 Bucket "${b.name}" (region: ${b.region || "unknown"}).`,
            source: "S3 ListBuckets",
            resourceId: b.name,
            resourceType: "s3",
            region: b.region,
          });
        }),
      dynamodb: (items) =>
        items.forEach((t: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `DynamoDB Table "${t.name}" (billingMode: ${t.billingMode || "unknown"}).`,
            source: "DynamoDB ListTables",
            resourceId: t.name,
            resourceType: "dynamodb",
            region: t.region,
          });
        }),
      elasticache: (items) =>
        items.forEach((c: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `ElastiCache "${c.id}" (engine: ${c.engine || "unknown"}, nodeType: ${c.nodeType || "unknown"}).`,
            source: "ElastiCache DescribeCacheClusters",
            resourceId: c.id,
            resourceType: "elasticache",
            region: c.region,
          });
        }),
      redshift: (items) =>
        items.forEach((c: any) => {
          facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `Redshift "${c.id}" (nodeType: ${c.nodeType || "unknown"}, nodes: ${c.numberOfNodes || 1}).`,
            source: "Redshift DescribeClusters",
            resourceId: c.id,
            resourceType: "redshift",
            region: c.region,
          });
        }),
    };

    for (const [svc, generator] of Object.entries(databaseInventoryMappings)) {
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

    if (!DATABASE_STORAGE_SERVICES.has(serviceName)) continue;

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
