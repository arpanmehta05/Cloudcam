import { getAzureAccessToken } from "./client-factory";
import axios from "axios";
import { LogQueryResult } from "../../models/aws.model";

/**
 * Interface to query workspace logs from Azure Log Analytics
 */
export async function queryAzureLogs(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    workspaceId: string,
    query: string,
    rangeSeconds: number = 3600
): Promise<LogQueryResult[]> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const url = `https://api.loganalytics.io/v1/workspaces/${workspaceId}/query`;
        
        // Log Analytics timespan query is handled inside the REST call headers or parameters.
        const res = await axios.post(url, {
            query: query
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        const tables = res.data?.tables || [];
        if (tables.length === 0) return [];

        const table = tables[0];
        const timeColIdx = table.columns.findIndex((c: any) => c.name === "TimeGenerated");
        const msgColIdx = table.columns.findIndex((c: any) => c.name === "RenderedMessage" || c.name === "Message" || c.name === "LogMessage");

        const results: LogQueryResult[] = (table.rows || []).map((row: any[]) => {
            const timeVal = timeColIdx >= 0 ? row[timeColIdx] : new Date().toISOString();
            const msgVal = msgColIdx >= 0 ? row[msgColIdx] : JSON.stringify(row);
            return {
                timestamp: timeVal,
                message: msgVal
            };
        });

        return results;
    } catch (error: any) {
        console.warn("[queryAzureLogs] Error querying Azure Log Analytics:", error.message);
        throw error;
    }
}

export async function getAzureServiceLogs(
    workspaceId: string,
    serviceKey: string,
    rangeSeconds: number = 3600,
    region?: string,
    tenantId?: string,
    subscriptionId?: string,
    clientId?: string,
    clientSecret?: string,
    resourceId?: string
): Promise<{ logs: LogQueryResult[]; logGroups: string[]; hasLogs: boolean; warnings?: string[] }> {
    const warnings: string[] = [];
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        return {
            logs: [],
            logGroups: [],
            hasLogs: false,
            warnings: ["Azure service principal credentials are required for logs."],
        };
    }

    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const startTime = new Date(Date.now() - rangeSeconds * 1000).toISOString();
        const filterParts = [`eventTimestamp ge '${startTime}'`];
        if (resourceId) {
            filterParts.push(`resourceUri eq '${resourceId}'`);
        }

        const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/microsoft.insights/eventtypes/management/values`;
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                "api-version": "2015-04-01",
                "$filter": filterParts.join(" and "),
                "$select": "eventTimestamp,level,operationName,resourceUri,status,subStatus,caller,claims,properties",
            },
            timeout: 10000,
        });

        const serviceNeedles: Record<string, string[]> = {
            ec2: ["microsoft.compute/virtualmachines"],
            compute: ["microsoft.compute/virtualmachines"],
            rds: ["microsoft.sql/", "microsoft.dbforpostgresql", "microsoft.dbformysql"],
            database: ["microsoft.sql/", "microsoft.dbforpostgresql", "microsoft.dbformysql"],
            s3: ["microsoft.storage/storageaccounts"],
            storage: ["microsoft.storage/storageaccounts"],
            lambda: ["microsoft.web/sites", "microsoft.app/containerapps"],
            serverless: ["microsoft.web/sites", "microsoft.app/containerapps"],
            amplify: ["microsoft.web/sites"],
            networking: ["microsoft.network/"],
            alb: ["microsoft.network/"],
            security: ["microsoft.security/", "microsoft.network/networksecuritygroups"],
        };
        const needles = serviceNeedles[serviceKey.toLowerCase()] || [];
        const entries = res.data?.value || [];
        const logs = entries
            .filter((entry: any) => {
                if (needles.length === 0) return true;
                const uri = String(entry.resourceUri || "").toLowerCase();
                const operation = String(entry.operationName?.value || entry.operationName?.localizedValue || "").toLowerCase();
                return needles.some(needle => uri.includes(needle) || operation.includes(needle));
            })
            .slice(0, 50)
            .map((entry: any) => {
                const operation = entry.operationName?.localizedValue || entry.operationName?.value || "Azure activity";
                const status = entry.status?.localizedValue || entry.status?.value || "Unknown";
                const resource = entry.resourceUri || serviceKey;
                return {
                    timestamp: entry.eventTimestamp || new Date().toISOString(),
                    message: `${operation} (${status})`,
                    severity: entry.level || "Informational",
                    resource,
                    provider: "azure",
                };
            });

        return {
            logs,
            logGroups: [`/azure/activity/${serviceKey}`],
            hasLogs: logs.length > 0,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    } catch (error: any) {
        warnings.push(`Azure Activity Log query failed: ${error?.response?.data?.error?.message || error.message || error}.`);
        return {
            logs: [],
            logGroups: [`/azure/activity/${serviceKey}`],
            hasLogs: false,
            warnings,
        };
    }
}
