// Azure Metrics Service — canonical location: modules/azure/services/metrics.service.ts
import { getAzureResourceMetric } from "../providers/metrics.provider";
import { getResources } from "./resources.service";
import { SERVICE_REGISTRY } from "../../../data/service-registry";

// Maps AWS metrics (keys from SERVICE_REGISTRY) to Azure Monitor Metric Names
const AZURE_METRIC_MAP: Record<string, Record<string, string>> = {
    ec2: {
        cpu: "Percentage CPU",
        network_in: "Network In",
        network_out: "Network Out",
        status_check: "Availability",
        disk_read_ops: "Disk Read Operations/Sec",
        disk_write_ops: "Disk Write Operations/Sec"
    },
    lambda: {
        invocations: "Invocations",
        errors: "Errors",
        duration: "Duration",
        concurrent: "ConcurrentExecutions",
        throttles: "Throttles"
    },
    rds: {
        cpu: "cpu_percent",
        connections: "connection_successful",
        free_storage: "storage_percent",
        read_iops: "read_iops",
        write_iops: "write_iops",
        read_latency: "read_latency",
        write_latency: "write_latency",
        freeable_memory: "freeable_memory"
    },
    s3: {
        size: "BlobCapacity",
        objects: "BlobCount"
    },
    ecs: {
        cpu: "CpuUtilized",
        memory: "MemoryUtilized",
        running_tasks: "RunningTasks",
        desired_tasks: "DesiredTasks",
        network_tx: "NetworkTxBytes",
        network_rx: "NetworkRxBytes"
    },
    alb: {
        requests: "Requests",
        target_response_time: "TargetResponseTime",
        healthy_hosts: "HealthyHosts",
        unhealthy_hosts: "UnhealthyHosts",
        active_connections: "ActiveConnections"
    },
    ebs: {
        read_ops: "DiskReadOperationsPerSec",
        write_ops: "DiskWriteOperationsPerSec",
        read_bytes: "DiskReadBytesPerSec",
        write_bytes: "DiskWriteBytesPerSec"
    },
    dynamodb: {
        consumed_read: "ConsumedReadCapacity",
        consumed_write: "ConsumedWriteCapacity",
        throttled_requests: "ThrottledRequests"
    },
    sqs: {
        messages_visible: "QueueMessageCount",
        messages_sent: "IncomingMessages",
        messages_received: "OutgoingMessages"
    },
    sns: {
        messages_published: "IncomingMessages",
        notifications_delivered: "OutgoingMessages"
    },
    amplify: {
        requests: "Requests",
        bytes_downloaded: "BytesSent",
        bytes_uploaded: "BytesReceived",
        "4xx_errors": "Http4xx",
        "5xx_errors": "Http5xx",
        latency: "AverageResponseTime"
    }
};

export async function getAzureServiceMetrics(
    workspaceId: string,
    serviceKey: string,
    range: string,
    region: string = "all",
    tenantId?: string,
    subscriptionId?: string,
    clientId?: string,
    clientSecret?: string,
    forceRefresh?: boolean
) {
    const categoryMap: Record<string, string> = {
        compute: "ec2",
        database: "rds",
        storage: "s3",
        serverless: "lambda",
        networking: "alb",
        security: "waf",
        gcp_compute: "ec2",
        gcp_storage: "s3",
        gcp_sql: "rds",
        gcp_function: "lambda",
        gcp_gke: "eks",
        azure_vm: "ec2",
        azure_storage: "s3",
        azure_sql: "rds",
        azure_function: "lambda",
        azure_vnet: "efs"
    };
    const mappedKey = categoryMap[serviceKey] || serviceKey;
    const serviceConfig = SERVICE_REGISTRY[mappedKey];
    if (!serviceConfig) {
        throw new Error(`Invalid or missing service key: ${serviceKey}`);
    }

    // 1. Get resources for the service to find active resource IDs
    let inventory: any = null;
    let resources: any[] = [];
    let inventoryError: any = null;
    try {
        inventory = await getResources(workspaceId, region, tenantId, subscriptionId, clientId, clientSecret, forceRefresh);
        let invKey = mappedKey;
        if (mappedKey === "networking") invKey = "alb";
        if (mappedKey === "security") invKey = "waf";
        resources = inventory[invKey] || [];
    } catch (err) {
        console.warn(`[getAzureServiceMetrics] Could not load resources to fetch metrics:`, err);
        inventoryError = err;
    }

    const metrics: Record<string, any> = {};
    const warningsSet = new Set<string>();
    if (inventoryError) {
        warningsSet.add(`Azure Monitor: ${inventoryError.message || inventoryError}`);
    }

    // 2. Fetch metrics for each definition
    const metricMapping = AZURE_METRIC_MAP[mappedKey] || {};

    for (const metricDef of serviceConfig.metrics) {
        const azureMetricName = metricMapping[metricDef.name] || metricDef.metricName;

        let resourceId: string | null = null;
        if (resources.length > 0) {
            const matchedResource = resources.find(r => r.id);
            if (matchedResource) {
                resourceId = matchedResource.id;
            }
        }

        if (resourceId && tenantId && subscriptionId && clientId && clientSecret) {
            try {
                const metricResult = await getAzureResourceMetric(
                    tenantId,
                    subscriptionId,
                    clientId,
                    clientSecret,
                    resourceId,
                    azureMetricName,
                    range,
                    metricDef.stat === "Sum" ? "Total" : "Average"
                );
                metrics[metricDef.name] = {
                    displayName: metricDef.metricName,
                    unit: metricDef.unit,
                    data: metricResult.data
                };
                if (metricResult.warnings) {
                    metricResult.warnings.forEach(w => warningsSet.add(w));
                }
                continue;
            } catch (err: any) {
                console.warn(`[getAzureServiceMetrics] Failed to fetch real Azure metric ${azureMetricName} for ${resourceId}:`, err);
                warningsSet.add(`Azure metric ${metricDef.name}: ${err.message || err}`);
            }
        }

        warningsSet.add(tenantId && subscriptionId && clientId && clientSecret
            ? resources.length === 0
                ? "Azure Monitor has no discovered resource for this service."
                : "Azure Monitor metric query did not return data for this metric."
            : "Azure service principal credentials are required for metrics.");
        metrics[metricDef.name] = {
            displayName: metricDef.metricName,
            unit: metricDef.unit,
            data: []
        };
    }

    const warnings = Array.from(warningsSet);

    return {
        service: serviceKey,
        metrics,
        warnings,
        diagnostics: {
            resourceCount: resources.length,
            regionsQueried: [region],
            successfulRegions: warnings.length === 0 ? 1 : 0,
            totalDatapoints: Object.values(metrics).reduce((sum, m) => sum + m.data.length, 0)
        }
    };
}
