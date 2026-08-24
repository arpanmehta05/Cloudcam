import { fetchMetrics } from "../../providers/cloudwatch.provider";
import { CloudWatchMetricQuery } from "../../../../models/metrics.model";
import { getResources } from "../resources/resources.service";
import { SERVICE_REGISTRY } from "../../../../data/service-registry";

export async function getNetworkingMetrics(
  workspaceId: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false
) {
  const service = SERVICE_REGISTRY["networking"];
  const inventory = await getResources(workspaceId, region, roleArn, externalId, forceRefresh);

  const queries: CloudWatchMetricQuery[] = [];
  const queryMeta: { metricName: string; queryIdx: number; queryRegion: string }[] = [];

  // ALB metrics — use the resource's own region
  const albItems = (inventory.alb || []).slice(0, 30);
  const albMetrics = service.metrics.filter((m: any) => m.namespace === "AWS/ApplicationELB");
  for (const item of albItems) {
    if (!item.id) continue;
    for (const m of albMetrics) {
      queries.push({
        namespace: m.namespace,
        metricName: m.metricName,
        stat: m.stat,
        dimensions: [{ Name: "LoadBalancer", Value: item.id }],
        period: (range === "1h") ? 60 : m.period
      });
      queryMeta.push({
        metricName: m.name,
        queryIdx: queries.length - 1,
        queryRegion: item.region || region || "us-east-1"
      });
    }
  }

  // CloudFront metrics — metrics are always stored in us-east-1 by AWS
  const cfItems = (inventory.cloudfront || []).slice(0, 30);
  const cfMetrics = service.metrics.filter((m: any) => m.namespace === "AWS/CloudFront");
  for (const item of cfItems) {
    if (!item.id) continue;
    for (const m of cfMetrics) {
      queries.push({
        namespace: m.namespace,
        metricName: m.metricName,
        stat: m.stat,
        dimensions: [
          { Name: "DistributionId", Value: item.id },
          { Name: "Region", Value: "Global" }
        ],
        period: (range === "1h") ? 60 : m.period
      });
      queryMeta.push({
        metricName: m.name,
        queryIdx: queries.length - 1,
        queryRegion: "us-east-1"
      });
    }
  }

  // Empty inventory — return zero-data structure
  if (queries.length === 0) {
    const metrics: Record<string, any> = {};
    service.metrics.forEach((m: any) => {
      metrics[m.name] = { displayName: m.metricName, unit: m.unit, data: [] };
    });
    return { service: "networking", metrics };
  }

  // Group by region and fetch in parallel
  const byRegion: Record<string, { queries: CloudWatchMetricQuery[]; meta: typeof queryMeta }> = {};
  for (let i = 0; i < queries.length; i++) {
    const r = queryMeta[i].queryRegion;
    if (!byRegion[r]) byRegion[r] = { queries: [], meta: [] };
    byRegion[r].queries.push(queries[i]);
    byRegion[r].meta.push({ ...queryMeta[i], queryIdx: byRegion[r].queries.length - 1 });
  }

  const regionFetches = await Promise.allSettled(
    Object.entries(byRegion).map(async ([r, data]) => {
      let allResults: any[] = [];
      for (let i = 0; i < data.queries.length; i += 480) {
        const batch = await fetchMetrics(workspaceId, data.queries.slice(i, i + 480), range, r, roleArn, externalId);
        allResults.push(...batch);
      }
      return { results: allResults, meta: data.meta };
    })
  );

  // Aggregate datapoints per metric name across all regions
  const aggregated: Record<string, any[]> = {};
  for (const entry of regionFetches) {
    if (entry.status !== "fulfilled") continue;
    for (const meta of entry.value.meta) {
      const series = entry.value.results[meta.queryIdx];
      if (!aggregated[meta.metricName]) aggregated[meta.metricName] = [];
      if (series?.datapoints?.length > 0) aggregated[meta.metricName].push(...series.datapoints);
    }
  }

  const metrics: Record<string, any> = {};
  for (const m of service.metrics) {
    const allPoints = aggregated[m.name] || [];
    if (allPoints.length === 0) {
      metrics[m.name] = { displayName: m.metricName, unit: m.unit, data: [] };
      continue;
    }
    const timeMap = new Map<string, { sum: number; count: number }>();
    for (const dp of allPoints) {
      const ex = timeMap.get(dp.timestamp) || { sum: 0, count: 0 };
      ex.sum += dp.value;
      ex.count += 1;
      timeMap.set(dp.timestamp, ex);
    }
    const isAvg = m.stat === "Average";
    metrics[m.name] = {
      displayName: m.metricName,
      unit: m.unit,
      data: Array.from(timeMap.entries())
        .map(([timestamp, { sum, count }]) => ({
          timestamp,
          value: Math.round((isAvg ? sum / count : sum) * 100) / 100
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    };
  }

  return { service: "networking", metrics };
}
