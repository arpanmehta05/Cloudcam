import { fetchMetrics } from "../../providers/cloudwatch.provider";
import { CloudWatchMetricQuery } from "../../../../models/metrics.model";
import { SERVICE_REGISTRY } from "../../../../data/service-registry";
import { getResources } from "../resources/resources.service";
import { SERVICE_DIMENSION_MAP } from "./query-builder";

export async function getInventoryBasedMetrics(
  workspaceId: string,
  serviceKey: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false
) {
  const service = SERVICE_REGISTRY[serviceKey];
  const dimMap = SERVICE_DIMENSION_MAP[serviceKey];

  if (!service) throw new Error("Invalid or missing service key");

  if (!dimMap) {
    return getFallbackMetrics(workspaceId, serviceKey, range, region, roleArn, externalId);
  }

  const inventory = await getResources(workspaceId, region, roleArn, externalId, forceRefresh);
  const resources = (inventory as any)[dimMap.inventoryKey] || [];

  if (resources.length === 0) {
    const metrics: Record<string, any> = {};
    service.metrics.forEach(m => {
      metrics[m.name] = { displayName: m.metricName, unit: m.unit, data: [] };
    });
    return { service: serviceKey, metrics };
  }

  const queries: CloudWatchMetricQuery[] = [];
  const queryMeta: { metricName: string; queryIdx: number; queryRegion: string }[] = [];

  const limitedResources = resources.slice(0, 30);
  console.log(`[Metrics] Found ${limitedResources.length} ${serviceKey} resources to query`);

  for (const resource of limitedResources) {
    const dims = dimMap.getDimensions(resource);
    const resourceRegion = dimMap.getRegion(resource);
    if (!dims[0]?.Value) {
      console.warn(`[Metrics] Skipping ${serviceKey} resource - missing dimension value:`, JSON.stringify(resource));
      continue;
    }

    for (const m of service.metrics) {
      queries.push({
        namespace: m.namespace,
        metricName: m.metricName,
        stat: m.stat,
        dimensions: dims,
        period: (range === "1h") ? 60 : m.period,
      });
      queryMeta.push({
        metricName: m.name,
        queryIdx: queries.length - 1,
        queryRegion: resourceRegion || region || "ap-south-1",
      });
    }
  }

  console.log(`[Metrics] Built ${queries.length} CloudWatch queries for ${serviceKey}`);
  const byRegion: Record<string, { queries: CloudWatchMetricQuery[]; meta: typeof queryMeta }> = {};
  for (let i = 0; i < queries.length; i++) {
    const r = queryMeta[i].queryRegion;
    if (!byRegion[r]) byRegion[r] = { queries: [], meta: [] };
    byRegion[r].queries.push(queries[i]);
    byRegion[r].meta.push({ ...queryMeta[i], queryIdx: byRegion[r].queries.length - 1 });
  }

  const regionEntries = Object.entries(byRegion);
  const regionFetches = await Promise.allSettled(
    regionEntries.map(async ([r, data]) => {
      const BATCH_SIZE = 480;
      let allResults: any[] = [];
      for (let i = 0; i < data.queries.length; i += BATCH_SIZE) {
        const batch = data.queries.slice(i, i + BATCH_SIZE);
        const batchResults = await fetchMetrics(workspaceId, batch, range, r, roleArn, externalId);
        allResults.push(...batchResults);
      }
      return { region: r, results: allResults, meta: data.meta };
    })
  );

  const aggregated: Record<string, any[]> = {};
  let successCount = 0;
  for (const entry of regionFetches) {
    if (entry.status !== "fulfilled") {
      console.warn("[Metrics] CloudWatch query failed:", (entry as any).reason);
      continue;
    }
    successCount++;
    for (const meta of entry.value.meta) {
      const series = entry.value.results[meta.queryIdx];
      if (!aggregated[meta.metricName]) aggregated[meta.metricName] = [];
      if (series?.datapoints?.length > 0) {
        aggregated[meta.metricName].push(...series.datapoints);
      }
    }
  }
  console.log(`[Metrics] CloudWatch query completed for ${serviceKey}: ${successCount}/${regionEntries.length} regions successful`);

  const metrics: Record<string, any> = {};
  for (const m of service.metrics) {
    const allPoints = aggregated[m.name] || [];
    if (allPoints.length === 0) {
      console.log(`[Metrics] No data for ${serviceKey}.${m.name} (${m.metricName}) - resources may be too new or don't have metrics`);
      metrics[m.name] = { displayName: m.metricName, unit: m.unit, data: [] };
      continue;
    }

    const bucketPeriodMs = ((range === "1h") ? 60 : m.period) * 1000;
    const timeMap = new Map<number, number[]>();

    for (const dp of allPoints) {
      const ts = new Date(dp.timestamp).getTime();
      const bucketTs = Math.floor(ts / bucketPeriodMs) * bucketPeriodMs;
      if (!timeMap.has(bucketTs)) timeMap.set(bucketTs, []);
      timeMap.get(bucketTs)!.push(dp.value);
    }

    const stat = m.stat;
    const data = Array.from(timeMap.entries())
      .map(([bucketTs, values]) => {
        let val = 0;
        if (stat === "Maximum") val = Math.max(...values);
        else if (stat === "Minimum") val = Math.min(...values);
        else if (stat === "Sum") val = values.reduce((a, b) => a + b, 0);
        else val = values.reduce((a, b) => a + b, 0) / values.length;

        return {
          timestamp: new Date(bucketTs).toISOString(),
          value: Math.round(val * 100) / 100,
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    metrics[m.name] = { displayName: m.metricName, unit: m.unit, data };
  }

  const totalPoints = Object.values(metrics).reduce((sub, m) => sub + (m as any).data.length, 0);
  console.log(`[Metrics] Finished ${serviceKey} aggregation: ${totalPoints} total datapoints across ${service.metrics.length} metrics`);

  return {
    service: serviceKey,
    metrics,
    diagnostics: {
      resourceCount: limitedResources.length,
      regionsQueried: Object.keys(byRegion),
      successfulRegions: successCount,
      totalDatapoints: totalPoints,
    },
  };
}

async function getFallbackMetrics(
  workspaceId: string,
  serviceKey: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string
) {
  const service = SERVICE_REGISTRY[serviceKey];
  const { discoverMetrics } = await import("../../providers/cloudwatch.provider");

  const queries: CloudWatchMetricQuery[] = [];
  const queryMetricMap: { metricName: string; queryIdx: number }[] = [];

  for (const m of service.metrics) {
    let discovered: any[] = [];
    try {
      discovered = await discoverMetrics(workspaceId, m.namespace, m.metricName, region, roleArn, externalId);
    } catch (e) { /* fallback to no dimensions */ }

    if (discovered.length > 0) {
      for (const metric of discovered.slice(0, 20)) {
        queries.push({
          namespace: m.namespace,
          metricName: m.metricName,
          stat: m.stat,
          dimensions: metric.Dimensions?.map((d: any) => ({ Name: d.Name, Value: d.Value })) || [],
          period: (range === "1h") ? 60 : m.period,
        });
        queryMetricMap.push({ metricName: m.name, queryIdx: queries.length - 1 });
      }
    } else {
      queries.push({
        namespace: m.namespace,
        metricName: m.metricName,
        stat: m.stat,
        dimensions: [],
        period: m.period,
      });
      queryMetricMap.push({ metricName: m.name, queryIdx: queries.length - 1 });
    }
  }

  let allResults: any[] = [];
  const BATCH_SIZE = 480;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchResults = await fetchMetrics(workspaceId, batch, range, region, roleArn, externalId);
    allResults.push(...batchResults);
  }

  const aggregated: Record<string, any[]> = {};
  for (const entry of queryMetricMap) {
    const series = allResults[entry.queryIdx];
    if (!aggregated[entry.metricName]) aggregated[entry.metricName] = [];
    if (series?.datapoints?.length > 0) {
      aggregated[entry.metricName].push(...series.datapoints);
    }
  }

  const metrics: Record<string, any> = {};
  for (const m of service.metrics) {
    const allPoints = aggregated[m.name] || [];
    if (allPoints.length === 0) {
      metrics[m.name] = { displayName: m.metricName, unit: m.unit, data: [] };
      continue;
    }
    const bucketPeriodMs = ((range === "1h") ? 60 : m.period) * 1000;
    const timeMap = new Map<number, number[]>();

    for (const dp of allPoints) {
      const ts = new Date(dp.timestamp).getTime();
      const bucketTs = Math.floor(ts / bucketPeriodMs) * bucketPeriodMs;
      if (!timeMap.has(bucketTs)) timeMap.set(bucketTs, []);
      timeMap.get(bucketTs)!.push(dp.value);
    }

    const stat = m.stat;
    const data = Array.from(timeMap.entries())
      .map(([bucketTs, values]) => {
        let val = 0;
        if (stat === "Maximum") val = Math.max(...values);
        else if (stat === "Minimum") val = Math.min(...values);
        else if (stat === "Sum") val = values.reduce((a, b) => a + b, 0);
        else val = values.reduce((a, b) => a + b, 0) / values.length;

        return {
          timestamp: new Date(bucketTs).toISOString(),
          value: Math.round(val * 100) / 100,
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    metrics[m.name] = { displayName: m.metricName, unit: m.unit, data };
  }

  return { service: serviceKey, metrics };
}
