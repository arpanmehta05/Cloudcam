// GCP Default Alarms Service — canonical location: modules/gcp/services/default-alarms.service.ts
import { getResources as getGcpResources } from "./resources.service";
import { getGcpAlertRules, putGcpMetricAlert } from "../providers/alerts.provider";

export interface ProvisionResult {
    created: number;
    failed: number;
    skipped: number;
    total: number;
    details: any[];
}

export interface GcpAlarmTemplate {
    nameSuffix: string;
    namespace: string;
    metricName: string;
    stat: "Average" | "Sum" | "Maximum" | "Minimum" | "Total";
    threshold: number;
    comparison: "GreaterThan" | "GreaterThanOrEqual" | "LessThan" | "LessThanOrEqual";
    period: number;
    evaluationPeriods: number;
    description: string;
}

export const GCP_DEFAULT_ALARM_TEMPLATES: Record<string, GcpAlarmTemplate[]> = {
    vm: [
        {
            nameSuffix: "High-CPU",
            namespace: "compute.googleapis.com/instance",
            metricName: "compute.googleapis.com/instance/cpu/utilization",
            stat: "Average",
            threshold: 0.80,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Compute Engine instance CPU usage is high (>80%)"
        }
    ],
    sql: [
        {
            nameSuffix: "High-CPU",
            namespace: "cloudsql.googleapis.com/database",
            metricName: "cloudsql.googleapis.com/database/cpu/utilization",
            stat: "Average",
            threshold: 0.90,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Cloud SQL CPU utilization is high (>90%)"
        }
    ],
    storage: [
        {
            nameSuffix: "High-Errors",
            namespace: "storage.googleapis.com/storage",
            metricName: "storage.googleapis.com/api/request_count",
            stat: "Sum",
            threshold: 100,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Storage bucket API request volume is elevated"
        }
    ],
    mig: [
        {
            nameSuffix: "Unhealthy-Instances",
            namespace: "compute.googleapis.com/InstanceGroup",
            metricName: "compute.googleapis.com/instance_group/unhealthy_instances",
            stat: "Average",
            threshold: 0,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Managed Instance Group has unhealthy instances (>0)"
        }
    ],
    gke: [
        {
            nameSuffix: "High-CPU-Allocatable",
            namespace: "container.googleapis.com/Cluster",
            metricName: "container.googleapis.com/cluster/cpu/allocatable_utilization",
            stat: "Average",
            threshold: 0.85,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "GKE Cluster allocatable CPU usage is high (>85%)"
        },
        {
            nameSuffix: "High-Memory-Allocatable",
            namespace: "container.googleapis.com/Cluster",
            metricName: "container.googleapis.com/cluster/memory/allocatable_utilization",
            stat: "Average",
            threshold: 0.85,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "GKE Cluster allocatable memory usage is high (>85%)"
        }
    ],
    artifactregistry: [
        {
            nameSuffix: "High-Requests",
            namespace: "artifactregistry.googleapis.com/Repository",
            metricName: "artifactregistry.googleapis.com/repository/request_count",
            stat: "Sum",
            threshold: 5000,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Artifact Registry repository request count is high (>5000)"
        }
    ],
    lb: [
        {
            nameSuffix: "High-Latency",
            namespace: "loadbalancing.googleapis.com/Https",
            metricName: "loadbalancing.googleapis.com/https/backend_latencies",
            stat: "Average",
            threshold: 2000,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Load Balancer backend latency is high (>2s)"
        }
    ],
    functions: [
        {
            nameSuffix: "High-Execution-Time",
            namespace: "cloudfunctions.googleapis.com/Function",
            metricName: "cloudfunctions.googleapis.com/function/execution_times",
            stat: "Average",
            threshold: 5000,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Cloud Function execution time is high (>5s)"
        },
        {
            nameSuffix: "High-Container-CPU",
            namespace: "run.googleapis.com/Service",
            metricName: "run.googleapis.com/container/cpu/utilization",
            stat: "Average",
            threshold: 0.85,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Cloud Run container CPU usage is high (>85%)"
        }
    ]
};

export async function provisionDefaultAlarms(
    userId: string,
    projectId: string | undefined,
    clientEmail: string | undefined,
    privateKey: string | undefined,
    alarmActions: string[] = []
): Promise<ProvisionResult> {
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing GCP credentials to provision default alarms");
    }

    const inventory = await getGcpResources(userId, "all", projectId, clientEmail, privateKey);
    const existingRes = await getGcpAlertRules(projectId, clientEmail, privateKey, "all");
    const existingNames = new Set(existingRes.alarms.map((a: any) => a.name));

    const results: any[] = [];
    let created = 0;
    let failed = 0;
    let skipped = 0;

    const tasks: { region: string; params: any; service: string; resourceId: string }[] = [];
    const services = ["vm", "sql", "storage", "mig", "gke", "artifactregistry", "lb", "functions"];

    for (const service of services) {
        let resources = (inventory as any)[service] || [];
        if (service === "vm" && !resources.length) resources = (inventory as any)["ec2"] || [];
        if (service === "sql" && !resources.length) resources = (inventory as any)["rds"] || [];
        if (service === "storage" && !resources.length) resources = (inventory as any)["s3"] || [];
        if (service === "mig" && !resources.length) resources = (inventory as any)["autoscaling"] || [];
        if (service === "gke" && !resources.length) resources = (inventory as any)["eks"] || [];
        if (service === "artifactregistry" && !resources.length) resources = (inventory as any)["ecr"] || [];
        if (service === "lb" && !resources.length) resources = (inventory as any)["alb"] || [];
        if (service === "functions" && !resources.length) resources = (inventory as any)["lambda"] || [];

        const templates = GCP_DEFAULT_ALARM_TEMPLATES[service] || [];

        for (const res of resources) {
            const resourceId = res.id || res.arn || res.name;
            if (!resourceId) continue;

            const region = res.region || res.location || "us-central1";

            for (const template of templates) {
                if (service === "functions") {
                    const isCloudRun = resourceId.toLowerCase().includes("locations/services") || res.uri;
                    const isFunc = !isCloudRun;
                    if (isCloudRun && template.namespace.includes("cloudfunctions")) continue;
                    if (isFunc && template.namespace.includes("run.googleapis.com")) continue;
                }

                const cleanResourceId = (res.name || resourceId.split("/").pop() || "res").replace(/[^a-zA-Z0-9_-]/g, "");
                const alarmName = `rabbittwatch-${service}-${template.nameSuffix}-${cleanResourceId}`.substring(0, 255);

                if (existingNames.has(alarmName)) {
                    skipped++;
                    results.push({ name: alarmName, status: "skipped", reason: "Already exists" });
                    continue;
                }

                const alarmParams: any = {
                    name: alarmName,
                    metric: template.metricName,
                    threshold: template.threshold,
                    comparison: template.comparison,
                    period: template.period,
                    evaluationPeriods: template.evaluationPeriods,
                    resourceId: resourceId,
                    resourceType: service === "vm" ? "gce_instance" :
                                  service === "sql" ? "cloudsql_database" :
                                  service === "storage" ? "gcs_bucket" :
                                  service === "mig" ? "instance_group" :
                                  service === "gke" ? "gke_cluster" :
                                  service === "artifactregistry" ? "artifactregistry" :
                                  service === "lb" ? "https_lb_rule" :
                                  template.namespace.includes("run") ? "cloud_run_revision" : "cloud_function",
                    actions: alarmActions
                };

                tasks.push({ region, params: alarmParams, service, resourceId });
            }
        }
    }

    const provisionResults = await Promise.allSettled(
        tasks.map(t => putGcpMetricAlert(projectId, clientEmail, privateKey, t.region, t.params.name, t.params))
    );

    provisionResults.forEach((res, i) => {
        const task = tasks[i];
        if (res.status === "fulfilled") {
            created++;
            results.push({ name: task.params.name, status: "created" });
        } else {
            failed++;
            results.push({ name: task.params.name, status: "failed", error: (res as any).reason?.message });
        }
    });

    return { created, failed, skipped, total: tasks.length + skipped, details: results };
}

export async function previewDefaultAlarms(
    userId: string,
    projectId: string | undefined,
    clientEmail: string | undefined,
    privateKey: string | undefined
): Promise<any> {
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing GCP credentials to preview default alarms");
    }

    const inventory = await getGcpResources(userId, "all", projectId, clientEmail, privateKey);
    const existingRes = await getGcpAlertRules(projectId, clientEmail, privateKey, "all");
    const existingNames = new Set(existingRes.alarms.map((a: any) => a.name));

    const preview: Record<string, { count: number; resources: number }> = {};
    let totalAlarms = 0;
    let totalResources = 0;

    const services = ["vm", "sql", "storage", "mig", "gke", "artifactregistry", "lb", "functions"];

    for (const service of services) {
        let resources = (inventory as any)[service] || [];
        if (service === "vm" && !resources.length) resources = (inventory as any)["ec2"] || [];
        if (service === "sql" && !resources.length) resources = (inventory as any)["rds"] || [];
        if (service === "storage" && !resources.length) resources = (inventory as any)["s3"] || [];
        if (service === "mig" && !resources.length) resources = (inventory as any)["autoscaling"] || [];
        if (service === "gke" && !resources.length) resources = (inventory as any)["eks"] || [];
        if (service === "artifactregistry" && !resources.length) resources = (inventory as any)["ecr"] || [];
        if (service === "lb" && !resources.length) resources = (inventory as any)["alb"] || [];
        if (service === "functions" && !resources.length) resources = (inventory as any)["lambda"] || [];

        const templates = GCP_DEFAULT_ALARM_TEMPLATES[service] || [];

        let alarmsForService = 0;
        let resourcesWithAlarms = 0;

        for (const res of resources) {
            let hasNewAlarm = false;
            const resourceId = res.id || res.arn || res.name;
            if (!resourceId) continue;

            for (const template of templates) {
                if (service === "functions") {
                    const isCloudRun = resourceId.toLowerCase().includes("locations/services") || res.uri;
                    const isFunc = !isCloudRun;
                    if (isCloudRun && template.namespace.includes("cloudfunctions")) continue;
                    if (isFunc && template.namespace.includes("run.googleapis.com")) continue;
                }

                const cleanResourceId = (res.name || resourceId.split("/").pop() || "res").replace(/[^a-zA-Z0-9_-]/g, "");
                const alarmName = `rabbittwatch-${service}-${template.nameSuffix}-${cleanResourceId}`.substring(0, 255);
                if (!existingNames.has(alarmName)) {
                    alarmsForService++;
                    hasNewAlarm = true;
                }
            }
            if (hasNewAlarm) resourcesWithAlarms++;
        }

        if (alarmsForService > 0) {
            preview[service] = { count: alarmsForService, resources: resourcesWithAlarms };
            totalAlarms += alarmsForService;
            totalResources += resourcesWithAlarms;
        }
    }

    return {
        summary: preview,
        totalAlarms,
        totalResources,
        inventory: inventory.counts
    };
}
