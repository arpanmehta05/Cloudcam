// Prometheus Query Provider
import { config } from "../config/env";
import { MetricResult, PrometheusResponse, MetricStats } from "../models/metrics.model";

const PROMETHEUS_URL = config.prometheusUrl;

// Fetch instant query
export async function fetchInstantMetric(query: string): Promise<MetricResult[]> {
    try {
        const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = (await response.json()) as PrometheusResponse;
        return data.data?.result || [];
    } catch (error) {
        console.error(`Error fetching ${query}:`, error);
        return [];
    }
}

// Convert time range string to seconds
function parseTimeRange(range: string): number {
    const match = range.match(/^(\d+)(h|d|w|m)$/);
    if (!match) return 86400;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case "h": return value * 3600;
        case "d": return value * 86400;
        case "w": return value * 604800;
        case "m": return value * 60;
        default: return 86400;
    }
}

// Fetch range query
export async function fetchRangeMetric(query: string, range: string): Promise<MetricResult[]> {
    const now = Math.floor(Date.now() / 1000);
    const seconds = parseTimeRange(range);
    const start = now - seconds;

    let step: string;
    if (seconds <= 3600) step = "1m";
    else if (seconds <= 21600) step = "5m";
    else if (seconds <= 86400) step = "30m";
    else if (seconds <= 604800) step = "6h";
    else step = "1d";

    try {
        const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${now}&step=${step}`;
        const response = await fetch(url);
        const data = (await response.json()) as PrometheusResponse;
        return data.data?.result || [];
    } catch (error) {
        console.error(`Error fetching range ${query}:`, error);
        return [];
    }
}

// Calculate statistics from time series data
export function calculateStats(results: MetricResult[]): MetricStats {
    if (!results.length || !results[0].values?.length) {
        return { current: 0, avg: 0, max: 0, min: 0, trend: "stable", datapoints: 0 };
    }
    const values = results[0].values.map(v => parseFloat(v[1])).filter(v => !isNaN(v));
    if (!values.length) {
        return { current: 0, avg: 0, max: 0, min: 0, trend: "stable", datapoints: 0 };
    }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const current = values[values.length - 1];

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

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

// Get single instant value
export function getInstantValue(results: MetricResult[]): number {
    if (!results.length || !results[0].value) return 0;
    return parseFloat(results[0].value[1]) || 0;
}

// Aggregate multiple results
export function aggregateResults(results: MetricResult[]): number {
    return results.reduce((sum, r) => {
        const value = r.value ? parseFloat(r.value[1]) : 0;
        return sum + (isNaN(value) ? 0 : value);
    }, 0);
}
