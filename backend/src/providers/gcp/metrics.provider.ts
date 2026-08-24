import { createGcpGoogleApisClient } from "./client-factory";

export interface GcpMetricPoint {
    timestamp: string;
    value: number;
}

export interface GcpMetricResponse {
    displayName: string;
    unit: string;
    data: GcpMetricPoint[];
    warnings?: string[];
}

function getRangeStart(range: string): Date {
    const now = Date.now();
    switch (range) {
        case "1h":
            return new Date(now - 3600 * 1000);
        case "6h":
            return new Date(now - 6 * 3600 * 1000);
        case "7d":
            return new Date(now - 7 * 24 * 3600 * 1000);
        case "30d":
            return new Date(now - 30 * 24 * 3600 * 1000);
        case "24h":
        default:
            return new Date(now - 24 * 3600 * 1000);
    }
}

function getAlignmentPeriod(range: string): string {
    switch (range) {
        case "1h":
            return "60s";
        case "6h":
            return "300s";
        case "24h":
            return "3600s";
        case "7d":
            return "14400s";
        case "30d":
            return "43200s";
        default:
            return "3600s";
    }
}

function getRangePeriodMs(range: string): number {
    switch (range) {
        case "1h":
            return 60 * 1000;
        case "6h":
            return 300 * 1000;
        case "24h":
            return 3600 * 1000;
        case "7d":
            return 14400 * 1000;
        case "30d":
            return 43200 * 1000;
        default:
            return 3600 * 1000;
    }
}

function getPerSeriesAligner(stat?: string): string {
    switch (stat) {
        case "Average":
            return "ALIGN_MEAN";
        case "Sum":
            return "ALIGN_SUM";
        case "Maximum":
            return "ALIGN_MAX";
        case "Minimum":
            return "ALIGN_MIN";
        case "SampleCount":
            return "ALIGN_COUNT";
        default:
            return "ALIGN_MEAN";
    }
}

function matchesResource(timeSeries: any, resourceId: string): boolean {
    if (!resourceId) return true;

    const resourceLabels = timeSeries.resource?.labels || {};
    const metricLabels = timeSeries.metric?.labels || {};

    // 1. Check direct matches on all label values
    for (const val of Object.values(resourceLabels)) {
        if (typeof val === "string" && (val === resourceId || val.endsWith(":" + resourceId))) {
            return true;
        }
    }
    for (const val of Object.values(metricLabels)) {
        if (typeof val === "string" && (val === resourceId || val.endsWith("/" + resourceId))) {
            return true;
        }
    }

    // 2. Specific resource label patterns
    if (resourceLabels.instance_id && resourceId.includes(resourceLabels.instance_id)) return true;
    if (resourceLabels.database_id && (resourceLabels.database_id.includes(resourceId) || resourceId.includes(resourceLabels.database_id))) return true;
    if (resourceLabels.bucket_name && resourceId.includes(resourceLabels.bucket_name)) return true;
    if (resourceLabels.function_name && resourceId.includes(resourceLabels.function_name)) return true;
    if (resourceLabels.service_name && resourceId.includes(resourceLabels.service_name)) return true;

    // 3. Fallback matching on base names
    const shortId = resourceId.split("/").pop();
    if (shortId) {
        if (resourceLabels.instance_id === shortId) return true;
        if (resourceLabels.bucket_name === shortId) return true;
        if (resourceLabels.function_name === shortId) return true;
        if (resourceLabels.service_name === shortId) return true;
    }

    return false;
}

function extractValue(valObj: any): number {
    if (!valObj) return 0;
    if (valObj.doubleValue !== undefined) return valObj.doubleValue;
    if (valObj.int64Value !== undefined) return Number(valObj.int64Value);
    if (valObj.distributionValue !== undefined) {
        const dist = valObj.distributionValue;
        if (dist.mean !== undefined) return dist.mean;
    }
    return 0;
}

export async function getGcpResourceMetric(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    resourceIdOrIds: string | string[],
    metricName: string,
    range: string,
    stat: string = "Average"
): Promise<GcpMetricResponse> {
    try {
        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Missing GCP integration credentials");
        }

        const clients = createGcpGoogleApisClient({ projectId, clientEmail, privateKey });

        const startTime = getRangeStart(range).toISOString();
        const endTime = new Date().toISOString();
        const alignmentPeriod = getAlignmentPeriod(range);
        let perSeriesAligner = getPerSeriesAligner(stat);
        if (metricName.includes("response_latencies")) {
            perSeriesAligner = "ALIGN_DELTA";
        }

        const response = await clients.monitoring.projects.timeSeries.list({
            name: `projects/${projectId}`,
            filter: `metric.type = "${metricName}"`,
            "interval.startTime": startTime,
            "interval.endTime": endTime,
            "aggregation.alignmentPeriod": alignmentPeriod,
            "aggregation.perSeriesAligner": perSeriesAligner,
        });

        const timeSeriesList = response.data?.timeSeries || [];

        // Filter by resource IDs
        const ids = Array.isArray(resourceIdOrIds) ? resourceIdOrIds : [resourceIdOrIds];
        const filteredTimeSeries = ids.length === 0
            ? timeSeriesList
            : timeSeriesList.filter((ts: any) => ids.some(id => matchesResource(ts, id)));

        const bucketPeriodMs = getRangePeriodMs(range);
        const timeMap = new Map<number, number[]>();

        for (const tsItem of filteredTimeSeries) {
            const points = tsItem.points || [];
            for (const pt of points) {
                const ts = new Date(pt.interval.endTime).getTime();
                const bucketTs = Math.floor(ts / bucketPeriodMs) * bucketPeriodMs;
                const val = extractValue(pt.value);

                // Parity normalization: GCP utilization is 0.0 - 1.0, convert to 0 - 100%
                let finalVal = val;
                if (metricName.endsWith("/utilization") || metricName.includes("/utilization/")) {
                    finalVal = val * 100;
                }

                if (!timeMap.has(bucketTs)) {
                    timeMap.set(bucketTs, []);
                }
                timeMap.get(bucketTs)!.push(finalVal);
            }
        }

        const data: GcpMetricPoint[] = Array.from(timeMap.entries())
            .map(([bucketTs, values]) => {
                let val = 0;
                if (stat === "Maximum") val = Math.max(...values);
                else if (stat === "Minimum") val = Math.min(...values);
                else if (stat === "Sum") val = values.reduce((a, b) => a + b, 0);
                else val = values.reduce((a, b) => a + b, 0) / values.length; // Average/Default

                return {
                    timestamp: new Date(bucketTs).toISOString(),
                    value: Math.round(val * 100) / 100,
                };
            })
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Select correct display units for the UI mapping
        let unit = "%";
        if (metricName.toLowerCase().includes("network") || metricName.toLowerCase().includes("bytes")) {
            unit = "bytes";
        } else if (metricName.toLowerCase().includes("count") || metricName.toLowerCase().includes("ops")) {
            unit = "count";
        } else if (metricName.toLowerCase().includes("latency") || metricName.toLowerCase().includes("duration")) {
            unit = "ms";
        }

        return {
            displayName: metricName,
            unit,
            data,
        };

    } catch (error: any) {
        console.warn(`[getGcpResourceMetric] Cloud Monitoring query failed:`, error.message || error);
        const warningMessage = error?.response?.data?.error?.message || error?.message || "Unknown error querying GCP Cloud Monitoring";

        let unit = "%";
        const metricLower = metricName.toLowerCase();
        if (metricLower.includes("network") || metricLower.includes("bytes") || metricLower.includes("sent") || metricLower.includes("received")) {
            unit = "bytes";
        } else if (metricLower.includes("count") || metricLower.includes("ops") || metricLower.includes("calls") || metricLower.includes("volume")) {
            unit = "count";
        } else if (metricLower.includes("latency") || metricLower.includes("delay") || metricLower.includes("duration")) {
            unit = "ms";
        }

        return {
            displayName: metricName,
            unit,
            data: [],
            warnings: [`GCP Monitoring: ${warningMessage}`]
        };
    }
}
