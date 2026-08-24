import { fetchMetrics } from "../../providers/cloudwatch.provider";
import { CloudWatchMetricQuery } from "../../../../models/metrics.model";
import { getResources } from "../resources/resources.service";

export async function getEcsMetrics(
  workspaceId: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false
) {
  const inventory = await getResources(workspaceId, region, roleArn, externalId, forceRefresh);
  const ecsServices: { cluster: string; name: string; region: string }[] = inventory.ecs
    .filter((s: any) => s.name && s.cluster && s.type !== "Cluster (no services)")
    .map((s: any) => ({ cluster: s.cluster, name: s.name, region: s.region || region || "ap-south-1" }));

  const emptyMetrics = {
    cpu: { displayName: "CPUUtilization", unit: "%", data: [] },
    memory: { displayName: "MemoryUtilization", unit: "%", data: [] },
    running_tasks: { displayName: "RunningTaskCount", unit: "count", data: [] },
    desired_tasks: { displayName: "DesiredTaskCount", unit: "count", data: [] },
    network_tx: { displayName: "NetworkTxBytes", unit: "bytes", data: [] },
    network_rx: { displayName: "NetworkRxBytes", unit: "bytes", data: [] },
  };

  if (ecsServices.length === 0) {
    console.log(`[Metrics] No ECS services found. Total ECS inventory: ${inventory.ecs?.length || 0}`);
    return { service: "ecs", metrics: emptyMetrics, services: [] };
  }
  console.log(`[Metrics] Found ${ecsServices.length} active ECS services to query`);

  const metricDefs = [
    { name: "cpu", namespace: "AWS/ECS", metricName: "CPUUtilization", stat: "Average", period: 300 },
    { name: "memory", namespace: "AWS/ECS", metricName: "MemoryUtilization", stat: "Average", period: 300 },
    { name: "running_tasks", namespace: "ECS/ContainerInsights", metricName: "RunningTaskCount", stat: "Average", period: 300 },
    { name: "desired_tasks", namespace: "ECS/ContainerInsights", metricName: "DesiredTaskCount", stat: "Average", period: 300 },
    { name: "network_tx", namespace: "ECS/ContainerInsights", metricName: "NetworkTxBytes", stat: "Sum", period: 300 },
    { name: "network_rx", namespace: "ECS/ContainerInsights", metricName: "NetworkRxBytes", stat: "Sum", period: 300 },
  ];

  // Group ECS services by region
  const byRegion: Record<string, typeof ecsServices> = {};
  for (const svc of ecsServices) {
    if (!byRegion[svc.region]) byRegion[svc.region] = [];
    byRegion[svc.region].push(svc);
  }

  // Build and fetch queries per region
  const allDatapoints: Record<string, any[]> = {};
  metricDefs.forEach((m) => { allDatapoints[m.name] = []; });
  const perService: Record<string, Record<string, number>> = {};

  const regionFetches = await Promise.allSettled(
    Object.entries(byRegion).map(async ([r, services]) => {
      const queries: CloudWatchMetricQuery[] = [];
      const queryMap: { svcKey: string; metricName: string; queryIdx: number }[] = [];

      services.forEach((svc) => {
        const svcKey = `${svc.cluster}:${svc.name}`;
        metricDefs.forEach((m) => {
          queries.push({
            namespace: m.namespace,
            metricName: m.metricName,
            stat: m.stat,
            dimensions: [
              { Name: "ClusterName", Value: svc.cluster },
              { Name: "ServiceName", Value: svc.name },
            ],
            period: (range === "1h") ? 60 : m.period,
          });
          queryMap.push({ svcKey, metricName: m.name, queryIdx: queries.length - 1 });
        });
      });

      let results: any[] = [];
      const BATCH_SIZE = 480;
      for (let i = 0; i < queries.length; i += BATCH_SIZE) {
        const batch = queries.slice(i, i + BATCH_SIZE);
        const batchResults = await fetchMetrics(workspaceId, batch, range, r, roleArn, externalId);
        results.push(...batchResults);
      }

      return { results, queryMap };
    })
  );

  for (const entry of regionFetches) {
    if (entry.status !== "fulfilled") continue;
    for (const meta of entry.value.queryMap) {
      const series = entry.value.results[meta.queryIdx];
      const datapoints = series?.datapoints || [];
      allDatapoints[meta.metricName].push(...datapoints);
      if (!perService[meta.svcKey]) perService[meta.svcKey] = {};
      const latest = datapoints.length ? datapoints[datapoints.length - 1].value : 0;
      perService[meta.svcKey][meta.metricName] = latest;
    }
  }

  // Build aggregated time series
  const metrics: Record<string, any> = {};
  metricDefs.forEach((m) => {
    const allPoints = allDatapoints[m.name];
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
    metrics[m.name] = {
      displayName: m.metricName,
      unit: m.name.includes("network") ? "bytes" : m.name.includes("task") ? "count" : "%",
      data,
    };
  });

  const services = ecsServices.map((svc) => {
    const key = `${svc.cluster}:${svc.name}`;
    return {
      cluster: svc.cluster,
      name: svc.name,
      region: svc.region,
      cpu: perService[key]?.cpu ?? 0,
      memory: perService[key]?.memory ?? 0,
      runningTasks: perService[key]?.running_tasks ?? 0,
      desiredTasks: perService[key]?.desired_tasks ?? 0,
    };
  });

  return { service: "ecs", metrics, services };
}
