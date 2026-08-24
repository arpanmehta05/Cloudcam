import { BigQuery } from "@google-cloud/bigquery";
import { normalizeGcpPrivateKey } from "./client-factory";

export interface CostResponse {
    total: number;
    unit: string;
    breakdown: Array<{ service: string; amount: number }>;
}

export interface TrendEntry {
    date: string;
    amount: number;
}

export interface ForecastResponse {
    amount: number;
    unit: string;
}

function getBigQueryClient(projectId: string, clientEmail: string, privateKey: string): BigQuery {
    return new BigQuery({
        projectId,
        credentials: {
            client_email: clientEmail,
            private_key: normalizeGcpPrivateKey(privateKey),
        },
    });
}

export async function getGcpMTDCost(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    billingDatasetId?: string,
    billingTableId?: string
): Promise<CostResponse> {
    if (!billingDatasetId || !billingTableId) {
        throw new Error("GCP billing BigQuery export is not configured.");
    }

    const client = getBigQueryClient(projectId, clientEmail, privateKey);
    const query = `
        SELECT
          IFNULL(service.description, 'Unknown') as service,
          SUM(cost) + SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) credit), 0)) as amount,
          ANY_VALUE(currency) as currency
        FROM \`${projectId}.${billingDatasetId}.${billingTableId}\`
        WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
        GROUP BY service
        ORDER BY amount DESC
    `;

    const [rows] = await client.query({ query });
    let total = 0;
    let unit = "USD";

    const breakdown = rows.map((row: any) => {
        const amount = Number(row.amount || 0);
        total += amount;
        if (row.currency) {
            unit = row.currency;
        }
        return {
            service: String(row.service),
            amount: Number(amount.toFixed(2))
        };
    });

    return {
        total: Number(total.toFixed(2)),
        unit,
        breakdown
    };
}

export async function getGcpCostByPeriod(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    days: number,
    billingDatasetId?: string,
    billingTableId?: string
): Promise<CostResponse> {
    if (!billingDatasetId || !billingTableId) {
        throw new Error("GCP billing BigQuery export is not configured.");
    }

    const client = getBigQueryClient(projectId, clientEmail, privateKey);
    const query = `
        SELECT
          IFNULL(service.description, 'Unknown') as service,
          SUM(cost) + SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) credit), 0)) as amount,
          ANY_VALUE(currency) as currency
        FROM \`${projectId}.${billingDatasetId}.${billingTableId}\`
        WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
        GROUP BY service
        ORDER BY amount DESC
    `;

    const [rows] = await client.query({
        query,
        params: { days }
    });

    let total = 0;
    let unit = "USD";

    const breakdown = rows.map((row: any) => {
        const amount = Number(row.amount || 0);
        total += amount;
        if (row.currency) {
            unit = row.currency;
        }
        return {
            service: String(row.service),
            amount: Number(amount.toFixed(2))
        };
    });

    return {
        total: Number(total.toFixed(2)),
        unit,
        breakdown
    };
}

export async function getGcpCostTrend(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    days: number,
    billingDatasetId?: string,
    billingTableId?: string
): Promise<TrendEntry[]> {
    if (!billingDatasetId || !billingTableId) {
        throw new Error("GCP billing BigQuery export is not configured.");
    }

    const client = getBigQueryClient(projectId, clientEmail, privateKey);
    const query = `
        SELECT
          FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time)) as date,
          SUM(cost) + SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) credit), 0)) as amount
        FROM \`${projectId}.${billingDatasetId}.${billingTableId}\`
        WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
        GROUP BY date
        ORDER BY date ASC
    `;

    const [rows] = await client.query({
        query,
        params: { days }
    });

    return rows.map((row: any) => ({
        date: String(row.date),
        amount: Number(Number(row.amount || 0).toFixed(2))
    }));
}

export async function getGcpCostForecast(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    billingDatasetId?: string,
    billingTableId?: string
): Promise<ForecastResponse | null> {
    if (!billingDatasetId || !billingTableId) {
        throw new Error("GCP billing BigQuery export is not configured.");
    }

    const client = getBigQueryClient(projectId, clientEmail, privateKey);
    const query = `
        SELECT
          (SUM(cost) + SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) credit), 0))) / 30 as daily_average,
          ANY_VALUE(currency) as currency
        FROM \`${projectId}.${billingDatasetId}.${billingTableId}\`
        WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    `;

    const [rows] = await client.query({ query });
    const dailyAverage = rows[0]?.daily_average ? Number(rows[0].daily_average) : 0;
    const currency = rows[0]?.currency || "USD";

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = Math.max(daysInMonth - currentDay, 1);

    return {
        amount: Number((dailyAverage * remainingDays).toFixed(2)),
        unit: currency
    };
}
