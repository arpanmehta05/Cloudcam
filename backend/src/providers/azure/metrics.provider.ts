import axios from "axios";
import { getAzureAccessToken } from "./client-factory";

export interface AzureMetricPoint {
    timestamp: string;
    value: number;
}

export interface AzureMetricResponse {
    displayName: string;
    unit: string;
    data: AzureMetricPoint[];
    warnings?: string[];
}

/**
 * Queries Azure Monitor metrics for a specific resource ID.
 */
export async function getAzureResourceMetric(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    resourceId: string,
    metricName: string,
    range: string,
    aggregation: string = "Average"
): Promise<AzureMetricResponse> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        
        let timespan = "PT30M";
        let interval = "PT1M";

        if (range === "1h") {
            timespan = "PT1H";
            interval = "PT1M";
        } else if (range === "6h") {
            timespan = "PT6H";
            interval = "PT5M";
        } else if (range === "24h") {
            timespan = "P1D";
            interval = "PT15M";
        } else if (range === "7d") {
            timespan = "P7D";
            interval = "PT1H";
        } else if (range === "30d") {
            timespan = "P30D";
            interval = "P1D";
        }

        const url = `https://management.azure.com${resourceId}/providers/Microsoft.Insights/metrics`;
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                "api-version": "2018-01-01",
                metricnames: metricName,
                timespan: timespan,
                interval: interval,
                aggregation: aggregation
            },
            timeout: 10000
        });

        const valueObj = res.data?.value?.[0];
        const name = valueObj?.name?.localizedValue || metricName;
        const unit = valueObj?.unit || "Percent";
        
        const dataPoints: AzureMetricPoint[] = (valueObj?.timeseries?.[0]?.data || []).map((point: any) => ({
            timestamp: point.timeStamp,
            value: point[aggregation.toLowerCase()] ?? 0
        })).filter((pt: any) => pt.timestamp);

        return {
            displayName: name,
            unit: unit === "Percent" ? "%" : unit.toLowerCase(),
            data: dataPoints
        };
    } catch (error: any) {
        console.warn(`[getAzureResourceMetric] Error fetching metric ${metricName} from Azure:`, error.message);

        let unit = "%";
        if (metricName.toLowerCase().includes("network") || metricName.toLowerCase().includes("byte") || metricName.toLowerCase().includes("size")) {
            unit = "bytes";
        } else if (metricName.toLowerCase().includes("count") || metricName.toLowerCase().includes("ops") || metricName.toLowerCase().includes("invocations") || metricName.toLowerCase().includes("requests")) {
            unit = "count";
        } else if (metricName.toLowerCase().includes("latency") || metricName.toLowerCase().includes("duration")) {
            unit = "ms";
        }

        return {
            displayName: metricName,
            unit,
            data: [],
            warnings: [`Azure Monitor: ${error?.response?.data?.error?.message || error.message || "Metric query failed"}`],
        };
    }
}
