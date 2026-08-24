// Azure Billing Service — canonical location: modules/azure/services/billing.service.ts
import { getAzureMTDCost, getAzureCostByPeriod, getAzureCostTrend, getAzureCostForecast } from "../providers/cost.provider";

const azureBillingCache = new Map<string, { data: any; expiresAt: number }>();
const azureForecastCache = new Map<string, { data: any; expiresAt: number }>();
const azureTrendCache = new Map<string, { data: any; expiresAt: number }>();
const activeBillingQueries = new Map<string, Promise<any>>();

export async function getBillingData(
    workspaceId: string,
    range: string = "24h",
    tenantId?: string,
    subscriptionId?: string,
    clientId?: string,
    clientSecret?: string,
    billingAccountId?: string,
    forceRefresh: boolean = false
) {
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        return {
            summary: {
                currentSpend: 0,
                mtdSpend: 0,
                unit: "USD",
                forecast: null,
                projectedTotal: null,
                range: "N/A",
            },
            mtdBreakdown: [],
            history: [],
            warning: "Azure billing failed: Missing Azure credentials to fetch billing data",
            setupRequired: true
        };
    }

    const cacheKey = `${workspaceId}:${range}:${billingAccountId || "default"}`;
    if (!forceRefresh) {
        const cached = azureBillingCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            console.log(`[Azure Billing] Cache HIT for workspace ${workspaceId} (${range})`);
            return cached.data;
        }

        const active = activeBillingQueries.get(cacheKey);
        if (active) {
            console.log(`[Azure Billing] Deduplicating parallel request for workspace ${workspaceId} (${range})`);
            return active;
        }
    }

    const queryPromise = (async () => {
        let spendData = { total: 0, unit: "USD", breakdown: [] as any[] };
        let mtdData = { total: 0, unit: "USD", breakdown: [] as any[] };
        let trend = [] as any[];
        let forecast = null as any;

        const days = range === "7d" ? 7 : (range === "24h" || range === "6h" || range === "1h") ? 1 : 30;
        const isMTD = range === "30d" || range === "mtd";
        const warnings: string[] = [];

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // 1. MTD and Period Cost (normal fetch)
        try {
            if (isMTD) {
                mtdData = await getAzureMTDCost(tenantId, subscriptionId, clientId, clientSecret, billingAccountId);
                spendData = mtdData;
            } else {
                spendData = await getAzureCostByPeriod(tenantId, subscriptionId, clientId, clientSecret, days, billingAccountId);
                await delay(1000); // 1s delay to avoid Azure 429
                mtdData = await getAzureMTDCost(tenantId, subscriptionId, clientId, clientSecret, billingAccountId);
            }
        } catch (e: any) {
            warnings.push(`Azure Cost query failed: ${e.message}`);
        }

        // 2. Get/cache trend (15 minutes expiration)
        if (warnings.length === 0) {
            await delay(1000); // 1s delay
            const trendCacheKey = `${tenantId}:${subscriptionId}:${range}:${billingAccountId || "default"}`;
            let trendFetched = false;
            if (!forceRefresh) {
                const cachedTrend = azureTrendCache.get(trendCacheKey);
                if (cachedTrend && Date.now() < cachedTrend.expiresAt) {
                    trend = cachedTrend.data;
                    trendFetched = true;
                }
            }
            if (!trendFetched) {
                try {
                    trend = await getAzureCostTrend(tenantId, subscriptionId, clientId, clientSecret, Math.max(days, 30), billingAccountId);
                    if (trend) {
                        azureTrendCache.set(trendCacheKey, { data: trend, expiresAt: Date.now() + 15 * 60 * 1000 });
                    }
                } catch (e: any) {
                    warnings.push(`Azure Cost trend query failed: ${e.message}`);
                }
            }
        }

        // 3. Get/cache forecast (1 hour expiration)
        if (warnings.length === 0) {
            await delay(1000); // 1s delay
            const forecastCacheKey = `${tenantId}:${subscriptionId}:${billingAccountId || "default"}`;
            let forecastFetched = false;
            if (!forceRefresh) {
                const cachedForecast = azureForecastCache.get(forecastCacheKey);
                if (cachedForecast && Date.now() < cachedForecast.expiresAt) {
                    forecast = cachedForecast.data;
                    forecastFetched = true;
                }
            }
            if (!forecastFetched) {
                try {
                    forecast = await getAzureCostForecast(tenantId, subscriptionId, clientId, clientSecret, billingAccountId);
                    if (forecast) {
                        azureForecastCache.set(forecastCacheKey, { data: forecast, expiresAt: Date.now() + 60 * 60 * 1000 });
                    }
                } catch (e: any) {
                    warnings.push(`Azure Cost forecast query failed: ${e.message}`);
                }
            }
        }

        if (warnings.length > 0 && spendData.total === 0 && mtdData.total === 0) {
            const fallbackCached = azureBillingCache.get(cacheKey);
            if (fallbackCached) {
                console.log(`[Azure Billing] Query failed, serving stale cached data as fallback for workspace ${workspaceId}`);
                return {
                    ...fallbackCached.data,
                    warning: `Azure Cost query failed (serving cached data): ${warnings.join(" ")}`,
                    warnings: [...(fallbackCached.data.warnings || []), ...warnings],
                };
            }

            return {
                summary: {
                    currentSpend: 0,
                    mtdSpend: 0,
                    unit: "USD",
                    forecast: null,
                    projectedTotal: null,
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
                mtdBreakdown: [],
                history: [],
                warning: warnings.join(" "),
                warnings,
                error: true,
            };
        }

        // Projection logic based on MTD
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDay = now.getDate();

        const mtdTotal = mtdData.total || spendData.total;
        const daysElapsed = Math.max(currentDay, 1);
        const dailyAverage = mtdTotal / daysElapsed;

        const linearProjectedTotal = mtdTotal > 0 ? dailyAverage * daysInMonth : null;

        let projectedTotal;
        if (mtdTotal <= 0.01) {
            projectedTotal = 0;
        } else if (forecast) {
            projectedTotal = forecast.amount;
        } else {
            projectedTotal = linearProjectedTotal;
        }

        // Sanity check
        if (projectedTotal > 0 && forecast && currentDay <= 7 && linearProjectedTotal && projectedTotal < linearProjectedTotal * 0.8) {
            projectedTotal = linearProjectedTotal;
        }

        const resultResponse = {
            summary: {
                currentSpend: spendData.total,
                mtdSpend: mtdData.total,
                unit: spendData.unit || mtdData.unit || "USD",
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
            },
            mtdBreakdown: mtdData.breakdown,
            history: trend,
            warning: warnings.length > 0 ? warnings.join(" ") : undefined,
            warnings,
        };

        if (spendData.total > 0 || mtdData.total > 0) {
            azureBillingCache.set(cacheKey, { data: resultResponse, expiresAt: Date.now() + 30 * 60 * 60 * 1000 });
        }

        return resultResponse;
    })();

    activeBillingQueries.set(cacheKey, queryPromise);
    try {
        return await queryPromise;
    } finally {
        activeBillingQueries.delete(cacheKey);
    }
}
