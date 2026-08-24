// GCP Metrics Service — canonical location: modules/gcp/services/metrics.service.ts
import { getGcpResourceMetric } from "../providers/metrics.provider";
import { getResources } from "./resources.service";
import { SERVICE_REGISTRY } from "../../../data/service-registry";

const GCP_METRIC_MAP: Record<string, Record<string, string>> = {
    ec2: {
        cpu: "compute.googleapis.com/instance/cpu/utilization",
        network_in: "compute.googleapis.com/instance/network/received_bytes_count",
        network_out: "compute.googleapis.com/instance/network/sent_bytes_count",
        status_check: "compute.googleapis.com/instance/uptime",
        disk_read_ops: "compute.googleapis.com/instance/disk/read_ops_count",
        disk_write_ops: "compute.googleapis.com/instance/disk/write_ops_count"
    },
    lambda: {
        invocations: "cloudfunctions.googleapis.com/function/execution_count",
        errors: "cloudfunctions.googleapis.com/function/execution_times",
        duration: "cloudfunctions.googleapis.com/function/execution_times",
        concurrent: "cloudfunctions.googleapis.com/function/active_instances",
        throttles: "cloudfunctions.googleapis.com/function/user_limit_concurrency"
    },
    rds: {
        cpu: "cloudsql.googleapis.com/database/cpu/utilization",
        connections: "cloudsql.googleapis.com/database/postgresql/num_backends",
        free_storage: "cloudsql.googleapis.com/database/disk/bytes_used",
        read_iops: "cloudsql.googleapis.com/database/disk/read_ops_count",
        write_iops: "cloudsql.googleapis.com/database/disk/write_ops_count",
        read_latency: "cloudsql.googleapis.com/database/disk/read_latency",
        write_latency: "cloudsql.googleapis.com/database/disk/write_latency",
        freeable_memory: "cloudsql.googleapis.com/database/memory/usage"
    },
    s3: {
        size: "storage.googleapis.com/storage/total_bytes",
        objects: "storage.googleapis.com/storage/object_count"
    },
    ecs: {
        cpu: "kubernetes.io/container/cpu/request_utilization",
        memory: "kubernetes.io/container/memory/request_utilization",
        running_tasks: "kubernetes.io/container/restart_count",
        desired_tasks: "kubernetes.io/container/restart_count",
        network_tx: "kubernetes.io/container/network/sent_bytes_count",
        network_rx: "kubernetes.io/container/network/received_bytes_count"
    },
    alb: {
        requests: "loadbalancing.googleapis.com/l7/client/request_count",
        target_response_time: "loadbalancing.googleapis.com/l7/client/latency",
        healthy_hosts: "loadbalancing.googleapis.com/l7/backend/healthy_backends",
        unhealthy_hosts: "loadbalancing.googleapis.com/l7/backend/unhealthy_backends",
        active_connections: "loadbalancing.googleapis.com/l7/client/active_connections"
    },
    ebs: {
        read_ops: "compute.googleapis.com/volume/read_ops_count",
        write_ops: "compute.googleapis.com/volume/write_ops_count",
        read_bytes: "compute.googleapis.com/volume/read_bytes_count",
        write_bytes: "compute.googleapis.com/volume/write_bytes_count"
    },
    dynamodb: {
        consumed_read: "spanner.googleapis.com/api/request_count",
        consumed_write: "spanner.googleapis.com/api/request_count",
        throttled_requests: "spanner.googleapis.com/api/error_count"
    },
    sqs: {
        messages_visible: "pubsub.googleapis.com/subscription/num_undelivered_messages",
        messages_sent: "pubsub.googleapis.com/topic/send_message_operation_count",
        messages_received: "pubsub.googleapis.com/subscription/pull_ack_message_operation_count"
    },
    sns: {
        messages_published: "pubsub.googleapis.com/topic/send_message_operation_count",
        notifications_delivered: "pubsub.googleapis.com/subscription/pull_ack_message_operation_count"
    },
    apigateway: {
        requests: "serviceruntime.googleapis.com/api/request_count"
    },
    amplify: {
        requests: "appengine.googleapis.com/http/server/response_count",
        bytes_downloaded: "appengine.googleapis.com/http/server/sent_bytes_count",
        bytes_uploaded: "appengine.googleapis.com/http/server/received_bytes_count",
        "4xx_errors": "appengine.googleapis.com/http/server/response_count",
        "5xx_errors": "appengine.googleapis.com/http/server/response_count",
        latency: "appengine.googleapis.com/http/server/response_latencies"
    }
};

const GCP_PROJECT_LEVEL_METRICS = new Set([
    "serviceruntime.googleapis.com/api/request_count",
    "appengine.googleapis.com/http/server/response_count",
    "appengine.googleapis.com/http/server/sent_bytes_count",
    "appengine.googleapis.com/http/server/received_bytes_count",
    "appengine.googleapis.com/http/server/response_latencies",
]);

export async function getGcpServiceMetrics(
    workspaceId: string,
    serviceKey: string,
    range: string,
    region: string = "all",
    projectId?: string,
    clientEmail?: string,
    privateKey?: string,
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

    let resources: any[] = [];
    let inventoryError: any = null;
    try {
        const inventory = await getResources(workspaceId, region, projectId, clientEmail, privateKey, forceRefresh);
        let invKey = mappedKey;
        if (mappedKey === "networking") invKey = "alb";
        if (mappedKey === "security") invKey = "waf";
        resources = inventory[invKey] || [];
    } catch (err) {
        console.warn(`[getGcpServiceMetrics] Could not load resources to fetch metrics:`, err);
        inventoryError = err;
    }

    const metrics: Record<string, any> = {};
    const metricMapping = GCP_METRIC_MAP[mappedKey] || {};
    const warningsSet = new Set<string>();

    if (inventoryError) {
        warningsSet.add(`GCP Monitoring: ${inventoryError.message || inventoryError}`);
    }

    const hasProjectLevelMetric = Object.values(metricMapping).some(metricName => GCP_PROJECT_LEVEL_METRICS.has(metricName));

    if (resources.length === 0 && !inventoryError && projectId && clientEmail && privateKey && !hasProjectLevelMetric) {
        for (const metricDef of serviceConfig.metrics) {
            metrics[metricDef.name] = {
                displayName: metricDef.metricName,
                unit: metricDef.unit,
                data: []
            };
        }
        return {
            service: serviceKey,
            metrics,
            warnings: [],
            diagnostics: {
                resourceCount: 0,
                regionsQueried: [region],
                successfulRegions: 1,
                totalDatapoints: 0
            }
        };
    }

    const resourceIds = resources.map(r => r.id).filter(Boolean);

    for (const metricDef of serviceConfig.metrics) {
        const gcpMetricName = metricMapping[metricDef.name] || metricDef.metricName;
        const isProjectLevelMetric = GCP_PROJECT_LEVEL_METRICS.has(gcpMetricName);

        if (projectId && clientEmail && privateKey && !inventoryError) {
            try {
                const metricResult = await getGcpResourceMetric(
                    projectId,
                    clientEmail,
                    privateKey,
                    isProjectLevelMetric ? [] : resourceIds,
                    gcpMetricName,
                    range,
                    metricDef.stat
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
                console.warn(`[getGcpServiceMetrics] Failed to fetch real GCP metric ${gcpMetricName}:`, err);
                warningsSet.add(`GCP Metric ${metricDef.name}: ${err.message || err}`);
            }
        }

        warningsSet.add(projectId && clientEmail && privateKey
            ? "GCP metrics could not be queried because resource inventory is unavailable."
            : "GCP credentials are not fully configured. Metrics are unavailable.");
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
