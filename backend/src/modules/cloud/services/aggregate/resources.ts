import { CloudProvider, CloudAggregateMetric, CloudAggregateLogEntry, CloudAggregateResponse, CloudProviderConnectionSummary } from "../../../../providers/cloud/types";
import { getAllProviderConnectionSummaries } from "../capabilities.service";
import { selectedProviders } from "./helpers";
import { getCredentials } from "../../../../store/workspace-credentials";
import { sanitizeProviderError, withProviderSync } from "../sync-guard.service";
import { getServiceMetrics as getAwsServiceMetrics } from "../../../../services/aws/metrics.service";
import { getAzureServiceMetrics } from "../../../../services/azure/metrics.service";
import { getGcpServiceMetrics } from "../../../../services/gcp/metrics.service";
import { getServiceLogs as getAwsServiceLogs } from "../../../../services/aws/logs.service";
import { getAzureServiceLogs } from "../../../../providers/azure/logs.provider";
import { getGcpServiceLogs } from "../../../../providers/gcp/logs.provider";

export async function getAggregateCloudMetrics(
    userId: string,
    provider: CloudProvider | "all",
    service: string,
    range: string,
    region: string,
    forceRefresh: boolean = false
): Promise<CloudAggregateResponse<CloudAggregateMetric>> {
    const categoryMap: Record<string, string> = {
        compute: "ec2",
        database: "rds",
        storage: "s3",
        serverless: "lambda",
        networking: "alb",
        security: "waf"
    };
    const mappedService = categoryMap[service] || service;

    const providerSummaries = await getAllProviderConnectionSummaries(userId);
    const targetProviders = selectedProviders(provider, providerSummaries);
    
    const results = await Promise.allSettled(
        targetProviders.map((prov) => withProviderSync(userId, prov, "metrics", async () => {
            const creds = await getCredentials(userId, prov);
            if (!creds) {
                return { provider: prov, data: [], warnings: [`${prov} is not connected.`] };
            }

            if (prov === "aws") {
                try {
                    const result = await getAwsServiceMetrics(userId, mappedService, range, region, creds.roleArn, creds.externalId, forceRefresh);
                    const data = Object.entries(result.metrics).map(([metricName, val]: [string, any]) => ({
                        provider: prov,
                        service,
                        metric: metricName,
                        displayName: val.displayName,
                        unit: val.unit,
                        data: val.data,
                    }));
                    return { provider: prov, data, warnings: [] };
                } catch (err: any) {
                    return { provider: prov, data: [], warnings: [`AWS metrics failed: ${err.message || err}`] };
                }
            }

            if (prov === "azure") {
                if (!creds.tenantId || !creds.subscriptionId || !creds.clientId || !creds.clientSecret) {
                    return {
                        provider: prov,
                        data: [],
                        warnings: ["Azure metrics require service principal client credentials. Principal-assignment onboarding is connected but limited."],
                    };
                }
                try {
                    const result = await getAzureServiceMetrics(
                        userId,
                        mappedService,
                        range,
                        region,
                        creds.tenantId,
                        creds.subscriptionId,
                        creds.clientId,
                        creds.clientSecret,
                        forceRefresh
                    );
                    const data = Object.entries(result.metrics).map(([metricName, val]: [string, any]) => ({
                        provider: prov,
                        service,
                        metric: metricName,
                        displayName: val.displayName,
                        unit: val.unit,
                        data: val.data,
                    }));
                    return { provider: prov, data, warnings: result.warnings || [] };
                } catch (err: any) {
                    return { provider: prov, data: [], warnings: [`Azure metrics failed: ${err.message || err}`] };
                }
            }

            // GCP provider
            if (!creds.projectId || !creds.clientEmail || !creds.privateKey) {
                return { provider: prov, data: [], warnings: ["GCP is not connected."] };
            }
            try {
                const result = await getGcpServiceMetrics(
                    userId,
                    mappedService,
                    range,
                    region,
                    creds.projectId,
                    creds.clientEmail,
                    creds.privateKey,
                    forceRefresh
                );
                const data = Object.entries(result.metrics).map(([metricName, val]: [string, any]) => ({
                    provider: prov,
                    service,
                    metric: metricName,
                    displayName: val.displayName,
                    unit: val.unit,
                    data: val.data,
                }));
                return { provider: prov, data, warnings: result.warnings || [] };
            } catch (err: any) {
                return { provider: prov, data: [], warnings: [`GCP metrics failed: ${err.message || err}`] };
            }
        }))
    );

    const data: CloudAggregateMetric[] = [];
    const warnings: string[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            data.push(...result.value.data);
            if (result.value.warnings) {
                warnings.push(...result.value.warnings);
            }
        } else {
            warnings.push(sanitizeProviderError(result.reason) || "Failed to load provider metrics.");
        }
    }

    return {
        success: true,
        providers: providerSummaries as Record<CloudProvider, CloudProviderConnectionSummary>,
        data,
        warnings,
    };
}

export async function getAggregateCloudLogs(
    userId: string,
    provider: CloudProvider | "all",
    service: string,
    range: number,
    region: string
): Promise<CloudAggregateResponse<CloudAggregateLogEntry>> {
    const providerSummaries = await getAllProviderConnectionSummaries(userId);
    const targetProviders = selectedProviders(provider, providerSummaries);

    const categoryMap: Record<string, string> = {
        compute: "ec2",
        database: "rds",
        storage: "s3",
        serverless: "lambda",
        networking: "networking",
        security: "security"
    };
    const mappedService = categoryMap[service] || service;

    const results = await Promise.allSettled(
        targetProviders.map((prov) => withProviderSync(userId, prov, "logs", async () => {
            const creds = await getCredentials(userId, prov);
            if (!creds) {
                return { provider: prov, data: [], warnings: [`${prov} is not connected.`] };
            }

            if (prov === "aws") {
                try {
                    const result = await getAwsServiceLogs(
                        userId,
                        mappedService,
                        range,
                        region,
                        creds.roleArn,
                        creds.externalId
                    );
                    const data = result.logs.map((log: any) => ({
                        provider: prov,
                        timestamp: log.timestamp || new Date().toISOString(),
                        severity: log.severity || "INFO",
                        message: log.message,
                        resource: log.resource || log.logStream || log.logGroup || mappedService,
                    }));
                    return { provider: prov, data, warnings: [] };
                } catch (err: any) {
                    return { provider: prov, data: [], warnings: [`AWS logs query failed: ${err.message || err}`] };
                }
            }

            if (prov === "azure") {
                try {
                    const result = await getAzureServiceLogs(
                        userId,
                        mappedService,
                        range,
                        region,
                        creds.tenantId,
                        creds.subscriptionId,
                        creds.clientId,
                        creds.clientSecret
                    );
                    const data = result.logs.map((log: any) => ({
                        provider: prov,
                        timestamp: log.timestamp || new Date().toISOString(),
                        severity: log.severity || "INFO",
                        message: log.message,
                        resource: log.resource || mappedService,
                    }));
                    return { provider: prov, data, warnings: result.warnings || [] };
                } catch (err: any) {
                    return { provider: prov, data: [], warnings: [`Azure logs query failed: ${err.message || err}`] };
                }
            }

            // GCP provider
            if (!creds.projectId || !creds.clientEmail || !creds.privateKey) {
                return { provider: prov, data: [], warnings: ["GCP is not connected."] };
            }

            try {
                const result = await getGcpServiceLogs(
                    creds.projectId,
                    mappedService,
                    range,
                    region,
                    creds.clientEmail,
                    creds.privateKey
                );
                const data = result.logs.map((log: any) => ({
                    provider: prov,
                    timestamp: log.timestamp || new Date().toISOString(),
                    severity: log.severity || "INFO",
                    message: log.message,
                    resource: log.resource || mappedService,
                }));
                return { provider: prov, data, warnings: result.warnings || [] };
            } catch (err: any) {
                return { provider: prov, data: [], warnings: [`GCP logs query failed: ${err.message || err}`] };
            }
        }))
    );

    const data: CloudAggregateLogEntry[] = [];
    const warnings: string[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            data.push(...result.value.data);
            if (result.value.warnings) {
                warnings.push(...result.value.warnings);
            }
        } else {
            warnings.push(sanitizeProviderError(result.reason) || "Failed to load provider logs.");
        }
    }

    const sortedLogs = data
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

    return {
        success: true,
        providers: providerSummaries as Record<CloudProvider, CloudProviderConnectionSummary>,
        data: sortedLogs,
        warnings,
    };
}
