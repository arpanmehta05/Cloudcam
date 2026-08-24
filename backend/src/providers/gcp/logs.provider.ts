import { LogQueryResult } from "../../models/aws.model";
import { createGcpGoogleApisClient } from "./client-factory";

export async function getGcpServiceLogs(
    projectId: string,
    serviceKey: string,
    rangeSeconds: number = 3600,
    region?: string,
    clientEmail?: string,
    privateKey?: string,
    resourceId?: string
): Promise<{ logs: LogQueryResult[]; logGroups: string[]; hasLogs: boolean; warnings?: string[] }> {
    const warnings: string[] = [];
    let clients: any;
    let logs: LogQueryResult[] = [];

    const hasCreds = projectId && clientEmail && privateKey;
    if (hasCreds) {
        try {
            clients = createGcpGoogleApisClient({ projectId, clientEmail, privateKey });
        } catch (e: any) {
            warnings.push(`GCP Auth client creation failed: ${e.message || e}`);
        }
    } else {
        warnings.push("GCP connection credentials not fully configured.");
    }

    if (clients) {
        try {
            const startTime = new Date(Date.now() - rangeSeconds * 1000).toISOString();
            const key = serviceKey.toLowerCase();
            const serviceFilters: string[] = [];

            if (key === "ec2" || key === "compute") {
                serviceFilters.push('resource.type="gce_instance"');
                if (resourceId) {
                    serviceFilters.push(`(resource.labels.instance_id="${resourceId}" OR resource.labels.instance_name="${resourceId}")`);
                }
            } else if (key === "rds" || key === "database") {
                serviceFilters.push('resource.type="cloudsql_database"');
                if (resourceId) {
                    serviceFilters.push(`resource.labels.database_id:"${resourceId}"`);
                }
            } else if (key === "s3" || key === "storage") {
                serviceFilters.push('resource.type="gcs_bucket"');
                if (resourceId) {
                    serviceFilters.push(`resource.labels.bucket_name="${resourceId}"`);
                }
            } else if (key === "lambda" || key === "serverless") {
                if (resourceId) {
                    serviceFilters.push(`((resource.type="cloud_function" AND resource.labels.function_name="${resourceId}") OR (resource.type="cloud_run_revision" AND resource.labels.service_name="${resourceId}"))`);
                } else {
                    serviceFilters.push('(resource.type="cloud_function" OR resource.type="cloud_run_revision")');
                }
            } else if (key === "amplify") {
                serviceFilters.push('resource.type="gae_app"');
            } else if (key === "networking" || key === "alb") {
                serviceFilters.push('(resource.type="http_load_balancer" OR resource.type="gce_forwarding_rule")');
            } else if (key === "pubsub" || key === "sqs" || key === "messaging") {
                serviceFilters.push('(resource.type="pubsub_topic" OR resource.type="pubsub_subscription")');
                if (resourceId) {
                    serviceFilters.push(`(resource.labels.topic_id:"${resourceId}" OR resource.labels.subscription_id:"${resourceId}")`);
                }
            } else {
                serviceFilters.push('logName:*');
            }

            const filterString = `${serviceFilters.join(" AND ")} AND timestamp >= "${startTime}"`;

            const response = await clients.logging.entries.list({
                requestBody: {
                    resourceNames: [`projects/${projectId}`],
                    filter: filterString,
                    orderBy: "timestamp desc",
                    pageSize: 50
                }
            });

            const entries = response?.data?.entries || [];
            logs = entries.map((entry: any) => {
                let message = "";
                if (entry.textPayload) {
                    message = entry.textPayload;
                } else if (entry.jsonPayload) {
                    message = typeof entry.jsonPayload === "string" ? entry.jsonPayload : JSON.stringify(entry.jsonPayload);
                } else if (entry.protoPayload) {
                    message = entry.protoPayload.message || JSON.stringify(entry.protoPayload);
                } else {
                    message = JSON.stringify(entry);
                }

                let resource = "unknown";
                if (entry.resource?.labels) {
                    resource = entry.resource.labels.instance_id ||
                               entry.resource.labels.bucket_name ||
                               entry.resource.labels.database_id ||
                               entry.resource.labels.function_name ||
                               entry.resource.labels.service_name ||
                               entry.resource.type ||
                               "gcp_resource";
                }

                return {
                    timestamp: entry.timestamp || new Date().toISOString(),
                    message,
                    severity: entry.severity || "INFO",
                    resource,
                    provider: "gcp",
                };
            });
        } catch (error: any) {
            const apiMsg = error?.response?.data?.error?.message || error?.message || error;
            warnings.push(`Google Cloud Logging query failed: ${apiMsg}.`);
            logs = [];
        }
    }

    return {
        logs,
        logGroups: [`/gcp/logging/${serviceKey}`],
        hasLogs: logs.length > 0,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}
