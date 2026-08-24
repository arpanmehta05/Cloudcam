// CloudWatch Query Helpers
// Centralized functions for querying AWS CloudWatch directly via SDK.

import {
    CloudWatchClient,
    GetMetricDataCommand,
    ListMetricsCommand,
    type MetricDataQuery,
    type MetricDataResult,
    type Metric,
} from "@aws-sdk/client-cloudwatch";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
    timestamp: string; // ISO string
    value: number;
}

export interface MetricTimeSeries {
    id: string;
    label: string;
    datapoints: TimeSeriesPoint[];
}

export interface MetricStats {
    current: number;
    avg: number;
    max: number;
    min: number;
    trend: "increasing" | "decreasing" | "stable";
    datapoints: number;
}

export interface CloudWatchMetricQuery {
    namespace: string;
    metricName: string;
    stat: string; // "Average", "Sum", "Maximum", "Minimum", "SampleCount"
    dimensions?: { Name: string; Value: string }[];
    period?: number; // seconds, default 300
}

// ─────────────────────────────────────────────────────────────
// Time Range Helpers
// ─────────────────────────────────────────────────────────────

export function parseTimeRange(range: string): { startTime: Date; endTime: Date; period: number } {
    const now = new Date();
    let seconds: number;

    const match = range.match(/^(\d+)(m|h|d|w)$/);
    if (!match) {
        seconds = 86400; // Default 24h
    } else {
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case "m": seconds = value * 60; break;
            case "h": seconds = value * 3600; break;
            case "d": seconds = value * 86400; break;
            case "w": seconds = value * 604800; break;
            default: seconds = 86400;
        }
    }

    // Calculate appropriate period (granularity) based on range
    let period: number;
    if (seconds <= 3600) period = 60;          // ≤ 1h → 1min steps
    else if (seconds <= 21600) period = 300;   // ≤ 6h → 5min steps
    else if (seconds <= 86400) period = 900;   // ≤ 24h → 15min steps
    else if (seconds <= 604800) period = 3600; // ≤ 7d → 1h steps
    else period = 86400;                        // > 7d → 1day steps

    return {
        startTime: new Date(now.getTime() - seconds * 1000),
        endTime: now,
        period,
    };
}

// ─────────────────────────────────────────────────────────────
// Core Query Functions
// ─────────────────────────────────────────────────────────────

/**
 * Fetch multiple CloudWatch metrics in a single batch API call.
 * Supports up to 500 metric queries per call.
 */
export async function fetchMetrics(
    workspaceId: string,
    queries: CloudWatchMetricQuery[],
    timeRange: string = "24h",
    region?: string,
    roleArn?: string,
    externalId?: string
): Promise<MetricTimeSeries[]> {
    const config = await getClientConfig(workspaceId, region || DEFAULT_REGION, roleArn, externalId);
    const client = new CloudWatchClient(config);
    const { startTime, endTime, period } = parseTimeRange(timeRange);

    // Build MetricDataQueries
    const metricDataQueries: MetricDataQuery[] = queries.map((q, idx) => ({
        Id: `m${idx}`,
        MetricStat: {
            Metric: {
                Namespace: q.namespace,
                MetricName: q.metricName,
                Dimensions: q.dimensions?.map(d => ({
                    Name: d.Name,
                    Value: d.Value,
                })),
            },
            Period: q.period || period,
            Stat: q.stat,
        },
        ReturnData: true,
    }));

    // CloudWatch allows max 500 queries per call
    const results: MetricTimeSeries[] = [];
    const batchSize = 500;

    for (let i = 0; i < metricDataQueries.length; i += batchSize) {
        const batch = metricDataQueries.slice(i, i + batchSize);

        const command = new GetMetricDataCommand({
            MetricDataQueries: batch,
            StartTime: startTime,
            EndTime: endTime,
            ScanBy: "TimestampAscending",
        });

        const response = await client.send(command);

        if (response.MetricDataResults) {
            for (const result of response.MetricDataResults) {
                const idx = parseInt(result.Id?.replace("m", "") || "0");
                const query = queries[i + idx];

                const datapoints: TimeSeriesPoint[] = [];
                if (result.Timestamps && result.Values) {
                    for (let j = 0; j < result.Timestamps.length; j++) {
                        datapoints.push({
                            timestamp: result.Timestamps[j].toISOString(),
                            value: Math.round(result.Values[j] * 100) / 100,
                        });
                    }
                }

                results.push({
                    id: result.Id || `m${i + idx}`,
                    label: `${query.namespace}/${query.metricName}`,
                    datapoints,
                });
            }
        }
    }

    return results;
}

/**
 * Discover available metrics for a given namespace.
 * Useful for auto-detecting what resources exist (e.g., which EC2 instances).
 */
export async function discoverMetrics(
    workspaceId: string,
    namespace: string,
    metricName?: string,
    region?: string,
    roleArn?: string,
    externalId?: string
): Promise<Metric[]> {
    const config = await getClientConfig(workspaceId, region || DEFAULT_REGION, roleArn, externalId);
    const client = new CloudWatchClient(config);

    const allMetrics: Metric[] = [];
    let nextToken: string | undefined;

    do {
        const command = new ListMetricsCommand({
            Namespace: namespace,
            MetricName: metricName,
            NextToken: nextToken,
        });

        const response = await client.send(command);
        if (response.Metrics) {
            allMetrics.push(...response.Metrics);
        }
        nextToken = response.NextToken;
    } while (nextToken);

    return allMetrics;
}

// ─────────────────────────────────────────────────────────────
// Statistics Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Calculate statistics from a time series.
 */
export function calculateMetricStats(series: TimeSeriesPoint[]): MetricStats {
    const values = series.map(d => d.value).filter(v => !isNaN(v));

    if (values.length === 0) {
        return { current: 0, avg: 0, max: 0, min: 0, trend: "stable", datapoints: 0 };
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const current = values[values.length - 1];

    // Calculate trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.length ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;

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

/**
 * Get the latest single value from a time series.
 */
export function getLatestValue(series: MetricTimeSeries): number {
    if (series.datapoints.length === 0) return 0;
    return series.datapoints[series.datapoints.length - 1].value;
}

/**
 * Sum all values in a time series (useful for counts like Lambda invocations).
 */
export function sumValues(series: MetricTimeSeries): number {
    return series.datapoints.reduce((sum, d) => sum + d.value, 0);
}
