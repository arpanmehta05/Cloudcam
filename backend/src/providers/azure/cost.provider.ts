import axios from "axios";
import { getAzureAccessToken } from "./client-factory";

async function postWithRetry(url: string, body: any, config: any, retries = 3, delay = 2000): Promise<any> {
    try {
        return await axios.post(url, body, config);
    } catch (error: any) {
        const status = error?.response?.status;
        if (status === 429 && retries > 0) {
            const retryAfter = error?.response?.headers?.["retry-after"];
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
            console.warn(`[Azure Cost API] Rate limited (429). Retrying in ${waitTime}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return postWithRetry(url, body, config, retries - 1, delay * 2);
        }
        throw error;
    }
}

export interface CostResponse {
    total: number;
    unit: string;
    breakdown: Array<{ service: string; amount: number }>;
    isSimulated?: boolean;
}

export interface TrendEntry {
    date: string;
    amount: number;
}

export interface ForecastResponse {
    amount: number;
    unit: string;
    isSimulated?: boolean;
}

function costManagementScope(subscriptionId: string, billingAccountId?: string): string {
    const billingScope = billingAccountId?.trim();
    if (!billingScope) return `/subscriptions/${subscriptionId}`;
    if (billingScope.startsWith("/providers/Microsoft.Billing/billingAccounts/")) {
        return billingScope;
    }
    return `/providers/Microsoft.Billing/billingAccounts/${billingScope}`;
}

/**
 * Gets Month-To-Date cost from Azure Cost Management API
 */
export async function getAzureMTDCost(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    billingAccountId?: string
): Promise<CostResponse> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const scope = costManagementScope(subscriptionId, billingAccountId);
        const url = `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

        const body = {
            type: "ActualCost",
            dataSet: {
                granularity: "None",
                aggregation: {
                    totalCost: {
                        name: "PreTaxCost",
                        function: "Sum"
                    }
                },
                grouping: [
                    {
                        type: "Dimension",
                        name: "ServiceName"
                    }
                ]
            },
            timeframe: "MonthToDate"
        };

        const res = await postWithRetry(url, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        // Parse Azure Cost Management query response columns & rows
        const columns = res.data?.properties?.columns || [];
        const rows = res.data?.properties?.rows || [];
        
        const costIndex = columns.findIndex((c: any) => c.name === "PreTaxCost" || c.name === "Cost");
        const serviceIndex = columns.findIndex((c: any) => c.name === "ServiceName");
        const currencyIndex = columns.findIndex((c: any) => c.name === "Currency");

        let total = 0;
        let currency = "USD";
        const breakdown: Array<{ service: string; amount: number }> = [];

        rows.forEach((row: any[]) => {
            const cost = Number(row[costIndex] || 0);
            const service = String(row[serviceIndex] || "Other");
            const cur = String(row[currencyIndex] || "USD");
            
            total += cost;
            currency = cur;
            breakdown.push({ service, amount: cost });
        });

        return { total, unit: currency, breakdown };
    } catch (error: any) {
        console.error("[getAzureMTDCost] Cost Management query failed:", error.message);
        throw error;
    }
}

/**
 * Gets Azure cost for a specific number of past days
 */
export async function getAzureCostByPeriod(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    days: number,
    billingAccountId?: string
): Promise<CostResponse> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const scope = costManagementScope(subscriptionId, billingAccountId);
        const url = `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const body = {
            type: "ActualCost",
            dataSet: {
                granularity: "None",
                aggregation: {
                    totalCost: {
                        name: "PreTaxCost",
                        function: "Sum"
                    }
                },
                grouping: [
                    {
                        type: "Dimension",
                        name: "ServiceName"
                    }
                ]
            },
            timeframe: "Custom",
            timePeriod: {
                from: startDate.toISOString().split("T")[0],
                to: endDate.toISOString().split("T")[0]
            }
        };

        const res = await postWithRetry(url, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        const columns = res.data?.properties?.columns || [];
        const rows = res.data?.properties?.rows || [];
        
        const costIndex = columns.findIndex((c: any) => c.name === "PreTaxCost" || c.name === "Cost");
        const serviceIndex = columns.findIndex((c: any) => c.name === "ServiceName");
        const currencyIndex = columns.findIndex((c: any) => c.name === "Currency");

        let total = 0;
        let currency = "USD";
        const breakdown: Array<{ service: string; amount: number }> = [];

        rows.forEach((row: any[]) => {
            const cost = Number(row[costIndex] || 0);
            const service = String(row[serviceIndex] || "Other");
            const cur = String(row[currencyIndex] || "USD");
            
            total += cost;
            currency = cur;
            breakdown.push({ service, amount: cost });
        });

        return { total, unit: currency, breakdown };
    } catch (error: any) {
        console.error("[getAzureCostByPeriod] Failed:", error.message);
        throw error;
    }
}

/**
 * Gets cost trend (daily breakdown) over past N days
 */
export async function getAzureCostTrend(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    days: number,
    billingAccountId?: string
): Promise<TrendEntry[]> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const scope = costManagementScope(subscriptionId, billingAccountId);
        const url = `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const body = {
            type: "ActualCost",
            dataSet: {
                granularity: "Daily",
                aggregation: {
                    totalCost: {
                        name: "PreTaxCost",
                        function: "Sum"
                    }
                },
                sorting: [
                    {
                        direction: "Ascending",
                        name: "UsageDate"
                    }
                ]
            },
            timeframe: "Custom",
            timePeriod: {
                from: startDate.toISOString().split("T")[0],
                to: endDate.toISOString().split("T")[0]
            }
        };

        const res = await postWithRetry(url, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        const columns = res.data?.properties?.columns || [];
        const rows = res.data?.properties?.rows || [];
        
        const costIndex = columns.findIndex((c: any) => c.name === "PreTaxCost" || c.name === "Cost");
        const dateIndex = columns.findIndex((c: any) => c.name === "UsageDate");

        return rows.map((row: any[]) => {
            let rawDate = String(row[dateIndex]);
            // Format YYYYMMDD to YYYY-MM-DD
            if (rawDate.length === 8) {
                rawDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
            }
            return {
                date: rawDate,
                amount: Math.round(Number(row[costIndex] || 0) * 100) / 100
            };
        });
    } catch (error: any) {
        console.error("[getAzureCostTrend] Failed:", error.message);
        throw error;
    }
}

/**
 * Gets Azure cost forecast for remaining billing cycle
 */
export async function getAzureCostForecast(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    billingAccountId?: string
): Promise<ForecastResponse | null> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const scope = costManagementScope(subscriptionId, billingAccountId);
        const url = `https://management.azure.com${scope}/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01`;

        const body = {
            type: "ActualCost",
            dataSet: {
                granularity: "None",
                aggregation: {
                    totalCost: {
                        name: "PreTaxCost",
                        function: "Sum"
                    }
                }
            },
            timeframe: "MonthToDate"
        };

        const res = await postWithRetry(url, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        const columns = res.data?.properties?.columns || [];
        const rows = res.data?.properties?.rows || [];
        
        const costIndex = columns.findIndex((c: any) => c.name === "PreTaxCost" || c.name === "Cost");
        const currencyIndex = columns.findIndex((c: any) => c.name === "Currency");

        if (rows.length > 0) {
            return {
                amount: Math.round(Number(rows[0][costIndex] || 0) * 100) / 100,
                unit: String(rows[0][currencyIndex] || "USD")
            };
        }
        return null;
    } catch (error: any) {
        console.error("[getAzureCostForecast] Forecast request failed:", error.message);
        return null;
    }
}

/**
 * Return static mock month-to-date data for simulations
 */
function getSimulatedMTD(): CostResponse {
    return {
        total: 102961.50,
        unit: "INR",
        breakdown: [
            { service: "Virtual Machines", amount: 46332.26 },
            { service: "SQL Database", amount: 25740.00 },
            { service: "Storage", amount: 15444.64 },
            { service: "App Service", amount: 10296.15 },
            { service: "Bandwidth & KeyVault", amount: 5148.45 }
        ]
    };
}

/**
 * Generates static trend dataset for simulations
 */
function getSimulatedTrend(days: number): TrendEntry[] {
    const trend: TrendEntry[] = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        // Add random variance to make it look realistic
        const baseCost = 3432.05; // 102961.50 / 30
        const variance = (Math.random() - 0.5) * 500;
        trend.push({
            date: d.toISOString().split("T")[0],
            amount: Number((baseCost + variance).toFixed(2))
        });
    }
    return trend;
}
