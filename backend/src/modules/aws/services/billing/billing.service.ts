// AWS Billing Service
import { getMonthToDateCost, getCostTrend, getCostForecast, getCostByPeriod } from "../../providers/cost-explorer.provider";

export async function getBillingData(workspaceId: string, range: string = "24h", roleArn?: string, externalId?: string) {
    let spendData = { total: 0, unit: "USD", breakdown: [] as any[] };
    let mtdData = { total: 0, unit: "USD", breakdown: [] as any[] };
    let trend = [] as any[];
    let forecast = null as any;

    const days = range === "7d" ? 7 : (range === "24h" || range === "6h" || range === "1h") ? 1 : 30;
    const isMTD = range === "30d" || range === "mtd";

    try {
        const results = await Promise.allSettled([
            // Primary view data
            isMTD
                ? getMonthToDateCost(workspaceId, roleArn, externalId)
                : getCostByPeriod(workspaceId, days, roleArn, externalId),
            // Always get MTD for accurate projections
            getMonthToDateCost(workspaceId, roleArn, externalId),
            getCostTrend(workspaceId, Math.max(days, 30), roleArn, externalId),
            getCostForecast(workspaceId, roleArn, externalId)
        ]);

        if (results[0].status === "fulfilled") spendData = results[0].value as any;
        if (results[1].status === "fulfilled") mtdData = results[1].value as any;
        if (results[2].status === "fulfilled") trend = results[2].value as any;
        if (results[3].status === "fulfilled") forecast = results[3].value as any;
    } catch (e: any) {
        console.warn("[Billing] Failed to fetch billing data:", e.message);
    }

    // Projection logic based on MTD
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();

    // We use MTD data for projection to ensure it's always "End of Month" estimate
    const mtdTotal = mtdData.total || spendData.total;
    // MTD includes today's accrued cost, so divide by current day count (not currentDay - 1).
    const daysElapsed = Math.max(currentDay, 1);
    const dailyAverage = mtdTotal / daysElapsed;

    const linearProjectedTotal = mtdTotal > 0 ? dailyAverage * daysInMonth : null;

    let projectedTotal = mtdTotal <= 0.01 ? 0 : (forecast
        ? (mtdTotal + (forecast.amount || 0))
        : linearProjectedTotal);

    // Sanity check: if forecast is available but seems too low compared to linear projection in early month
    if (projectedTotal > 0 && forecast && currentDay <= 7 && linearProjectedTotal && projectedTotal < linearProjectedTotal * 0.8) {
        projectedTotal = linearProjectedTotal;
    }

    return {
        summary: {
            currentSpend: spendData.total,
            mtdSpend: mtdData.total, // TRUE Month-to-Date total
            unit: spendData.unit,
            forecast: forecast?.amount || null,
            projectedTotal: projectedTotal,
            range: isMTD
                ? "Month to Date"
                : range === "7d"
                    ? "Last 7 Days"
                    : range === "6h"
                        ? "Last 6 Hours"
                        : range === "1h"
                            ? "Last 1 Hour"
                            : "Last 24 Hours",
        },
        mtdBreakdown: mtdData.breakdown,
        history: trend,
    };
}
