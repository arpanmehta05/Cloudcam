/**
 * metric-chart-config.ts
 * Utility functions that drive per-service, per-metric chart rendering.
 * Every decision is tied to the unit and metric name from SERVICE_REGISTRY.
 */

// ─────────────────────────────────────────────────────────────
// Chart Type
// ─────────────────────────────────────────────────────────────

/**
 * Returns the ideal Recharts chart type based on the metric unit from SERVICE_REGISTRY.
 *
 * - count / count/s  → Bar   (discrete events: invocations, errors, messages)
 * - ms / s           → Line  (latency / duration — continuous, no fill needed)
 * - % / bytes / etc  → Area  (utilisation, throughput — gradient fill)
 */
export function getChartType(unit: string): "area" | "line" | "bar" {
    if (["count", "count/s"].includes(unit)) return "bar";
    if (["ms", "s", "Milliseconds", "Seconds"].includes(unit)) return "line";
    return "area";
}

// ─────────────────────────────────────────────────────────────
// Chart Color
// ─────────────────────────────────────────────────────────────

/**
 * Returns a hex color for the chart stroke/fill based on metric semantics.
 * Error/throttle metrics → red, CPU/memory → amber, network/requests → blue.
 */
export function getMetricColor(metricName: string): string {
    const n = metricName.toLowerCase();
    if (
        n.includes("error") || n.includes("fail") || n.includes("throttl") ||
        n.includes("unhealthy") || n.includes("blocked") || n.includes("exceeded")
    ) return "#ef4444";  // red-500

    if (
        n.includes("cpu") || n.includes("memory") || n.includes("disk") ||
        n.includes("eviction") || n.includes("miss")
    ) return "#f59e0b";  // amber-500

    if (
        n.includes("network") || n.includes("bytes") || n.includes("request") ||
        n.includes("invocation") || n.includes("message") || n.includes("hit")
    ) return "#3b82f6";  // blue-500

    return "hsl(var(--primary))";
}

// ─────────────────────────────────────────────────────────────
// Value Formatter
// ─────────────────────────────────────────────────────────────

/**
 * Formats a raw numeric value for display in chart tooltips and stat rows.
 * Driven by the `unit` field from SERVICE_REGISTRY metric definitions.
 */
export function formatMetricValue(value: number, unit: string): string {
    if (value === null || value === undefined || isNaN(value)) return "—";

    const u = unit ?? "";

    // Byte-based units
    if (u === "bytes" || u === "bytes/s") {
        if (value === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.min(Math.floor(Math.log(Math.abs(value)) / Math.log(k)), sizes.length - 1);
        const suffix = u === "bytes/s" ? "/s" : "";
        return `${(value / Math.pow(k, i)).toFixed(1)} ${sizes[i]}${suffix}`;
    }

    // Time units
    if (u === "ms" || u === "Milliseconds") return `${value.toFixed(0)} ms`;
    if (u === "s" || u === "Seconds") return `${value.toFixed(3)} s`;

    // Percentage
    if (u === "%") return `${value.toFixed(1)}%`;

    // Rate
    if (u === "count/s") return `${value.toFixed(1)}/s`;

    // Generic count / everything else
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
}

// ─────────────────────────────────────────────────────────────
// Stats Calculator
// ─────────────────────────────────────────────────────────────

export interface MetricStats {
    current: number;
    avg: number;
    max: number;
    min: number;
}

/**
 * Computes current/avg/max/min from a time-series data array.
 * Returns null if no data.
 */
export function calcMetricStats(
    data: Array<{ timestamp: string; value: number }>
): MetricStats | null {
    if (!data?.length) return null;
    const vals = data.map(d => d.value);
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
        current: vals[vals.length - 1],
        avg: sum / vals.length,
        max: Math.max(...vals),
        min: Math.min(...vals),
    };
}
