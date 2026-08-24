// CloudWatch Metrics Provider
import {
  CloudWatchClient,
  GetMetricDataCommand,
  ListMetricsCommand,
  type MetricDataQuery,
  type Metric,
} from "@aws-sdk/client-cloudwatch";
import { getClientConfig } from "./client-factory";
import {
  CloudWatchMetricQuery,
  MetricTimeSeries,
  TimeSeriesPoint,
  MetricStats,
} from "../../../models/metrics.model";

function parseTimeRange(range: string): {
  startTime: Date;
  endTime: Date;
  period: number;
} {
  const now = new Date();
  const endTime = now;
  let startTime: Date;
  let period: number;

  switch (range) {
    case "1h":
      startTime = new Date(now.getTime() - 3600 * 1000);
      period = 60;
      break;
    case "6h":
      startTime = new Date(now.getTime() - 6 * 3600 * 1000);
      period = 300;
      break;
    case "24h":
      startTime = new Date(now.getTime() - 24 * 3600 * 1000);
      period = 900;
      break;
    case "7d":
      startTime = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      period = 3600;
      break;
    case "30d":
      startTime = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      period = 86400;
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 3600 * 1000);
      period = 900;
  }
  return { startTime, endTime, period };
}

export async function fetchMetrics(
  workspaceId: string,
  queries: CloudWatchMetricQuery[],
  timeRange: string = "24h",
  region?: string,
  roleArn?: string,
  externalId?: string,
): Promise<MetricTimeSeries[]> {
  const clientConfig = await getClientConfig(
    workspaceId,
    region,
    roleArn,
    externalId,
  );
  const client = new CloudWatchClient(clientConfig);
  const { startTime, endTime, period } = parseTimeRange(timeRange);

  const metricDataQueries: MetricDataQuery[] = queries.map((q, idx) => ({
    Id: `m${idx}`,
    MetricStat: {
      Metric: {
        Namespace: q.namespace,
        MetricName: q.metricName,
        Dimensions: q.dimensions?.map((d) => ({
          Name: d.Name,
          Value: d.Value,
        })),
      },
      Period: q.period || period,
      Stat: q.stat,
    },
    ReturnData: true,
  }));

  if (metricDataQueries.length === 0) return [];

  const resultByMId: Record<string, any> = {};
  let nextToken: string | undefined;

  try {
    do {
      const command = new GetMetricDataCommand({
        MetricDataQueries: metricDataQueries,
        StartTime: startTime,
        EndTime: endTime,
        NextToken: nextToken,
      });

      const response = await client.send(command);

      (response.MetricDataResults || []).forEach((r) => {
        if (r.Id) {
          if (!resultByMId[r.Id]) {
            resultByMId[r.Id] = r;
          } else {
            // Append additional datapoints from pagination
            if (r.Timestamps)
              resultByMId[r.Id].Timestamps.push(...r.Timestamps);
            if (r.Values) resultByMId[r.Id].Values.push(...r.Values);
          }
        }
      });

      nextToken = response.NextToken;
    } while (nextToken);
  } catch (err: any) {
    console.error(
      `[CloudWatch] GetMetricData Error in ${region}:`,
      err.message,
    );
    // Return whatever we have so far or throw if absolutely nothing
  }

  return queries.map((q, idx) => {
    const mid = `m${idx}`;
    const result = resultByMId[mid];

    const datapoints: TimeSeriesPoint[] = [];
    const timestamps = result?.Timestamps || [];
    const values = result?.Values || [];

    // Note: CloudWatch may return data in any order; sort by time
    const paired = timestamps
      .map((t: Date, i: number) => ({ t, v: values[i] }))
      .sort((a: any, b: any) => a.t.getTime() - b.t.getTime());

    for (const item of paired) {
      datapoints.push({
        timestamp: item.t.toISOString(),
        value: Math.round(item.v * 100) / 100,
      });
    }

    return {
      id: mid,
      label: result?.Label || q.metricName || `metric_${idx}`,
      datapoints,
    };
  });
}

export async function discoverMetrics(
  workspaceId: string,
  namespace: string,
  metricName?: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
): Promise<Metric[]> {
  const clientConfig = await getClientConfig(
    workspaceId,
    region,
    roleArn,
    externalId,
  );
  const client = new CloudWatchClient(clientConfig);

  const command = new ListMetricsCommand({
    Namespace: namespace,
    MetricName: metricName,
  });

  const response = await client.send(command);
  return response.Metrics || [];
}

export function calculateMetricStats(series: TimeSeriesPoint[]): MetricStats {
  if (!series.length) {
    return {
      current: 0,
      avg: 0,
      max: 0,
      min: 0,
      trend: "stable",
      datapoints: 0,
    };
  }
  const values = series.map((p) => p.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const current = values[values.length - 1];

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.length
    ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    : 0;
  const secondAvg = secondHalf.length
    ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    : 0;

  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (secondAvg > firstAvg * 1.1) trend = "increasing";
  if (secondAvg < firstAvg * 0.9) trend = "decreasing";

  return {
    current: Math.round(current * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    max: Math.round(max * 100) / 100,
    min: Math.round(min * 100) / 100,
    trend,
    datapoints: values.length,
  };
}

export function getLatestValue(series: MetricTimeSeries): number {
  if (!series.datapoints.length) return 0;
  return series.datapoints[series.datapoints.length - 1].value;
}

export function sumValues(series: MetricTimeSeries): number {
  return series.datapoints.reduce((sum, p) => sum + p.value, 0);
}
