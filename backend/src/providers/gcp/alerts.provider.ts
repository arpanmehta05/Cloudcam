import { v3 } from "@google-cloud/monitoring";
import { normalizeGcpPrivateKey } from "./client-factory";

export interface GcpAlertParams {
    name: string;
    metric: string;
    threshold: number;
    comparison: string; // e.g. GreaterThan, GreaterThanOrEqual, LessThan, LessThanOrEqual
    period: number;
    evaluationPeriods: number;
    resourceId: string;
    resourceType?: string;
    actions?: string[]; // Notification Channel Resource Names
}

function getMonitoringClient(projectId: string, clientEmail: string, privateKey: string) {
    return new v3.AlertPolicyServiceClient({
        projectId,
        credentials: {
            client_email: clientEmail,
            private_key: normalizeGcpPrivateKey(privateKey),
        },
    });
}

function getNotificationClient(projectId: string, clientEmail: string, privateKey: string) {
    return new v3.NotificationChannelServiceClient({
        projectId,
        credentials: {
            client_email: clientEmail,
            private_key: normalizeGcpPrivateKey(privateKey),
        },
    });
}

function normalizeComparisonOperator(op: string): string {
    switch (op) {
        case "GreaterThanOrEqualToThreshold":
        case "GreaterThanOrEqual":
            return "COMPARISON_GT";
        case "GreaterThanThreshold":
        case "GreaterThan":
            return "COMPARISON_GT";
        case "LessThanOrEqualToThreshold":
        case "LessThanOrEqual":
            return "COMPARISON_LT";
        case "LessThanThreshold":
        case "LessThan":
            return "COMPARISON_LT";
        default:
            return "COMPARISON_GT";
    }
}

function denormalizeComparisonOperator(op: string): string {
    switch (op) {
        case "COMPARISON_GT":
            return "GreaterThanThreshold";
        case "COMPARISON_LT":
            return "LessThanThreshold";
        default:
            return "GreaterThanThreshold";
    }
}

export async function getGcpAlertRules(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    region?: string
): Promise<{ alarms: any[]; counts: { total: number; alarm: number; ok: number; insufficient: number } }> {
    try {
        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Missing GCP credentials");
        }

        const client = getMonitoringClient(projectId, clientEmail, privateKey);
        const [policies] = await client.listAlertPolicies({ name: client.projectPath(projectId) });
        const selectedRegion = !region || region === "all" ? undefined : region;

        const alarms = policies
            .map((policy: any) => {
                const condition = policy.conditions?.[0] || {};
                const threshold = condition.conditionThreshold || {};
                const filter = threshold.filter || "";
                const regionMatch = filter.match(/resource\.labels\.zone\s*=\s*"([^"]+)"/);
                const policyRegion = regionMatch?.[1]?.replace(/-[a-z]$/, "") || "global";

                return {
                    name: policy.displayName || policy.name,
                    arn: policy.name,
                    state: policy.enabled === false ? "INSUFFICIENT_DATA" : "OK",
                    namespace: filter.match(/metric\.type\s*=\s*"([^"]+)"/)?.[1]?.split("/").slice(0, -1).join("/") || "monitoring.googleapis.com",
                    metric: filter.match(/metric\.type\s*=\s*"([^"]+)"/)?.[1] || "",
                    reason: policy.documentation?.content || "Cloud Monitoring alert policy",
                    updatedAt: policy.creationRecord?.mutateTime?.seconds
                        ? new Date(Number(policy.creationRecord.mutateTime.seconds) * 1000).toISOString()
                        : new Date().toISOString(),
                    region: policyRegion,
                    type: "metric",
                    actionsEnabled: policy.enabled !== false,
                    actions: policy.notificationChannels || [],
                    comparison: denormalizeComparisonOperator(threshold.comparison || ""),
                    threshold: threshold.thresholdValue ?? 0,
                    period: Number(threshold.duration?.seconds || 0),
                    evaluationPeriods: 1,
                    statistic: "Average",
                    dimensions: []
                };
            })
            .filter((alarm: any) => !selectedRegion || alarm.region === selectedRegion || alarm.region === "global");

        return {
            alarms,
            counts: {
                total: alarms.length,
                alarm: alarms.filter(r => r.state === "ALARM").length,
                ok: alarms.filter(r => r.state === "OK").length,
                insufficient: alarms.filter(r => r.state === "INSUFFICIENT_DATA").length
            }
        };
    } catch (error: any) {
        console.warn("[getGcpAlertRules] Error fetching alerts:", error.message);
        return {
            alarms: [],
            counts: {
                total: 0,
                alarm: 0,
                ok: 0,
                insufficient: 0
            }
        };
    }
}

export async function putGcpMetricAlert(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    region: string,
    alarmName: string,
    params: GcpAlertParams
): Promise<{ success: boolean; message: string }> {
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing GCP credentials");
    }

    const client = getMonitoringClient(projectId, clientEmail, privateKey);
    const name = client.projectPath(projectId);
    const comparison = normalizeComparisonOperator(params.comparison);
    const durationSeconds = Math.max(Number(params.period || 300) * Math.max(Number(params.evaluationPeriods || 1), 1), 60);
    const filterParts = [`metric.type = "${params.metric}"`];
    if (params.resourceId) {
        const resourceType = params.resourceType || (() => {
            const m = params.metric;
            if (m.startsWith("storage.googleapis.com/")) return "gcs_bucket";
            if (m.startsWith("cloudsql.googleapis.com/")) return "cloudsql_database";
            if (m.startsWith("container.googleapis.com/")) return "gke_cluster";
            if (m.startsWith("run.googleapis.com/")) return "cloud_run_revision";
            if (m.startsWith("cloudfunctions.googleapis.com/")) return "cloud_function";
            if (m.startsWith("artifactregistry.googleapis.com/")) return "artifactregistry";
            if (m.startsWith("compute.googleapis.com/instance_group")) return "instance_group";
            if (m.startsWith("loadbalancing.googleapis.com/")) return "https_lb_rule";
            return "gce_instance";
        })();

        if (resourceType === "gcs_bucket" || resourceType === "storage.googleapis.com/Bucket") {
            filterParts.push(`resource.type = "gcs_bucket"`);
            filterParts.push(`resource.labels.bucket_name = "${params.resourceId}"`);
        } else if (resourceType === "cloudsql_database") {
            filterParts.push(`resource.type = "cloudsql_database"`);
            const dbId = params.resourceId.includes(":") ? params.resourceId : `${projectId}:${params.resourceId}`;
            filterParts.push(`resource.labels.database_id = "${dbId}"`);
        } else if (resourceType === "gke_cluster") {
            filterParts.push(`resource.type = "gke_cluster"`);
            filterParts.push(`resource.labels.cluster_name = "${params.resourceId}"`);
        } else if (resourceType === "cloud_run_revision" || resourceType === "run.googleapis.com/Service") {
            filterParts.push(`resource.type = "cloud_run_revision"`);
            filterParts.push(`resource.labels.service_name = "${params.resourceId}"`);
        } else if (resourceType === "cloud_function") {
            filterParts.push(`resource.type = "cloud_function"`);
            filterParts.push(`resource.labels.function_name = "${params.resourceId}"`);
        } else if (resourceType === "instance_group") {
            filterParts.push(`resource.type = "instance_group"`);
            filterParts.push(`resource.labels.instance_group_name = "${params.resourceId}"`);
        } else if (resourceType === "https_lb_rule" || resourceType === "loadbalancing.googleapis.com/Https") {
            filterParts.push(`resource.type = "https_lb_rule"`);
            filterParts.push(`resource.labels.url_map_name = "${params.resourceId}"`);
        } else if (resourceType.includes("artifactregistry")) {
            filterParts.push(`resource.type = "artifactregistry.googleapis.com/Repository"`);
            filterParts.push(`resource.labels.repository_id = "${params.resourceId}"`);
        } else {
            filterParts.push(`resource.type = "gce_instance"`);
            filterParts.push(`resource.labels.instance_id = "${params.resourceId}"`);
        }
    }

    await client.createAlertPolicy({
        name,
        alertPolicy: {
            displayName: alarmName,
            enabled: { value: true },
            combiner: "OR",
            notificationChannels: params.actions || [],
            conditions: [{
                displayName: alarmName,
                conditionThreshold: {
                    filter: filterParts.join(" AND "),
                    comparison,
                    thresholdValue: params.threshold,
                    duration: { seconds: durationSeconds },
                    aggregations: [{
                        alignmentPeriod: { seconds: Math.max(Number(params.period || 300), 60) },
                        perSeriesAligner: "ALIGN_MEAN",
                    }],
                },
            }],
        },
    } as any);

    return { success: true, message: `Alert policy ${alarmName} saved successfully.` };
}

export async function toggleGcpAlertRule(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    alarmName: string,
    enabled: boolean
): Promise<{ success: boolean; enabled: boolean; message: string }> {
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing GCP credentials");
    }

    const client = getMonitoringClient(projectId, clientEmail, privateKey);
    const name = alarmName.startsWith("projects/") ? alarmName : `${client.projectPath(projectId)}/alertPolicies/${alarmName}`;
    await client.updateAlertPolicy({
        alertPolicy: { name, enabled: { value: enabled } },
        updateMask: { paths: ["enabled"] },
    } as any);

    return { success: true, enabled, message: `Alert policy ${enabled ? "enabled" : "disabled"} for ${alarmName}` };
}

export async function deleteGcpAlertRule(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    alarmName: string
): Promise<{ success: boolean; message: string }> {
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing GCP credentials");
    }

    const client = getMonitoringClient(projectId, clientEmail, privateKey);
    const name = alarmName.startsWith("projects/") ? alarmName : `${client.projectPath(projectId)}/alertPolicies/${alarmName}`;
    await client.deleteAlertPolicy({ name });
    return { success: true, message: `Alert rule ${alarmName} deleted successfully.` };
}

export async function getGcpNotificationChannels(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    region?: string
): Promise<Array<{ label: string; value: string }>> {
    try {
        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Missing GCP credentials");
        }

        const client = getNotificationClient(projectId, clientEmail, privateKey);
        const [channels] = await client.listNotificationChannels({ name: client.projectPath(projectId) });
        return channels
            .filter((channel: any) => channel.enabled !== false)
            .map((channel: any) => ({
                label: `${channel.displayName || channel.name} (${channel.type || "channel"})`,
                value: channel.name,
            }));
    } catch (error: any) {
        console.warn("[getGcpNotificationChannels] Error fetching notification channels:", error.message);
        return [];
    }
}

function getSimulatedAlertRules(region?: string): any[] {
    const isGlobal = !region || region === "all";
    const selectedRegion = isGlobal ? "us-central1" : region;
    
    return [
        {
            name: "rabbittwatch-gcp-high-cpu-vm-prod-01",
            arn: `projects/project-123/alertPolicies/gcp-high-cpu-vm-prod-01`,
            state: "OK",
            namespace: "compute.googleapis.com/instance",
            metric: "compute.googleapis.com/instance/cpu/utilization",
            reason: "CPU utilization is normal",
            updatedAt: new Date().toISOString(),
            region: selectedRegion,
            type: "metric",
            actionsEnabled: true,
            actions: ["projects/project-123/notificationChannels/default-channel"],
            comparison: "GreaterThanThreshold",
            threshold: 0.8,
            period: 300,
            evaluationPeriods: 1,
            statistic: "Average",
            dimensions: []
        }
    ];
}
