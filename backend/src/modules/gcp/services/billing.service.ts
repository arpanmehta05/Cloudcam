// GCP Billing Service — canonical location: modules/gcp/services/billing.service.ts
import {
    getGcpMTDCost,
    getGcpCostByPeriod,
    getGcpCostTrend,
    getGcpCostForecast,
} from "../providers/billing.provider";

export async function getGcpBillingData(
    workspaceId: string,
    range: string = "24h",
    projectId?: string,
    clientEmail?: string,
    privateKey?: string,
    billingDatasetId?: string,
    billingTableId?: string
) {
    let spendData = { total: 0, unit: "USD", breakdown: [] as any[] };
    let mtdData = { total: 0, unit: "USD", breakdown: [] as any[] };
    let trend = [] as any[];
    let forecast = null as any;

    const days = range === "7d" ? 7 : (range === "24h" || range === "6h" || range === "1h") ? 1 : 30;
    const isMTD = range === "30d" || range === "mtd";

    let warning: string | undefined = undefined;
    let setupRequired = false;
    let dataSource: "bigquery" | "unconfigured" | "query_failed" = "bigquery";

    if (!projectId || !clientEmail || !privateKey || !billingDatasetId || !billingTableId) {
        setupRequired = true;
        dataSource = "unconfigured";
        warning = "GCP billing BigQuery export is not configured. Displaying 0 until a real billing export dataset and table are configured in GCP Settings.";
    }

    if (!setupRequired) {
        try {
            const results = await Promise.all([
                isMTD
                    ? getGcpMTDCost(projectId!, clientEmail!, privateKey!, billingDatasetId!, billingTableId!)
                    : getGcpCostByPeriod(projectId!, clientEmail!, privateKey!, days, billingDatasetId!, billingTableId!),
                getGcpMTDCost(projectId!, clientEmail!, privateKey!, billingDatasetId!, billingTableId!),
                getGcpCostTrend(projectId!, clientEmail!, privateKey!, Math.max(days, 30), billingDatasetId!, billingTableId!),
                getGcpCostForecast(projectId!, clientEmail!, privateKey!, billingDatasetId!, billingTableId!)
            ]);

            spendData = results[0];
            mtdData = results[1];
            trend = results[2];
            forecast = results[3];

            if (mtdData.breakdown.length === 0 && mtdData.total === 0) {
                warning = "GCP billing BigQuery export is configured, but the export table returned no rows for the current month. GCP billing export is not retroactive and can take several hours to populate after setup.";
            }
        } catch (e: any) {
            console.warn("[GCP Billing Service] Failed to fetch real BigQuery billing data:", e.message);
            dataSource = "query_failed";
            warning = `GCP billing BigQuery query failed: ${e.message}. Please check your credentials and configuration in Settings.`;
        }
    }

    // Projection calculation
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();

    const mtdTotal = mtdData.total || spendData.total;
    const daysElapsed = Math.max(currentDay, 1);
    const dailyAverage = mtdTotal / daysElapsed;

    const linearProjectedTotal = mtdTotal > 0 ? dailyAverage * daysInMonth : null;
    let projectedTotal = mtdTotal <= 0.01 ? 0 : (forecast
        ? (mtdTotal + (forecast.amount || 0))
        : linearProjectedTotal);

    if (projectedTotal > 0 && forecast && currentDay <= 7 && linearProjectedTotal && projectedTotal < linearProjectedTotal * 0.8) {
        projectedTotal = linearProjectedTotal;
    }

    const displayUnit = mtdData.unit || spendData.unit || forecast?.unit || "USD";

    return {
        summary: {
            currentSpend: spendData.total,
            mtdSpend: mtdData.total,
            unit: displayUnit,
            currentSpendUnit: spendData.unit,
            mtdSpendUnit: mtdData.unit,
            forecast: forecast?.amount || null,
            projectedTotal: projectedTotal ? Number(projectedTotal.toFixed(2)) : null,
            range: isMTD
                ? "Month to Date"
                : range === "7d"
                    ? "Last 7 Days"
                    : range === "6h"
                        ? "Last 6 Hours"
                        : range === "1h"
                            ? "Last 1 Hour"
                            : "Last 24 Hours",
            isSimulated: false,
            dataSource
        },
        mtdBreakdown: mtdData.breakdown,
        history: trend,
        warning,
        setupRequired,
        isSimulated: false,
        dataSource
    };
}
