// Azure Default Alarms Service — canonical location: modules/azure/services/default-alarms.service.ts
import { getResources } from "./resources.service";
import { getAzureAlertRules, putAzureMetricAlert } from "../providers/alerts.provider";

export interface ProvisionResult {
    created: number;
    failed: number;
    skipped: number;
    total: number;
    details: any[];
}

export interface AzureAlarmTemplate {
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

export const AZURE_DEFAULT_ALARM_TEMPLATES: Record<string, AzureAlarmTemplate[]> = {
    vm: [
        {
            nameSuffix: "High-CPU",
            namespace: "Microsoft.Compute/virtualMachines",
            metricName: "Percentage CPU",
            stat: "Average",
            threshold: 80,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "VM CPU usage is high (>80%)"
        },
        {
            nameSuffix: "Low-Available-Memory",
            namespace: "Microsoft.Compute/virtualMachines",
            metricName: "Available Memory Bytes",
            stat: "Average",
            threshold: 1073741824, // 1 GB
            comparison: "LessThan",
            period: 300,
            evaluationPeriods: 1,
            description: "VM Available Memory is low (<1GB)"
        }
    ],
    sql: [
        {
            nameSuffix: "High-DTU",
            namespace: "Microsoft.Sql/servers/databases",
            metricName: "dtu_consumption_percent",
            stat: "Average",
            threshold: 90,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "SQL Database DTU consumption is high (>90%)"
        }
    ],
    storage: [
        {
            nameSuffix: "Low-Availability",
            namespace: "Microsoft.Storage/storageAccounts",
            metricName: "Availability",
            stat: "Average",
            threshold: 99,
            comparison: "LessThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Storage account availability is low (<99%)"
        }
    ],
    vmss: [
        {
            nameSuffix: "High-CPU",
            namespace: "Microsoft.Compute/virtualMachineScaleSets",
            metricName: "Percentage CPU",
            stat: "Average",
            threshold: 80,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "VMSS CPU usage is high (>80%)"
        },
        {
            nameSuffix: "Low-Available-Memory",
            namespace: "Microsoft.Compute/virtualMachineScaleSets",
            metricName: "Available Memory Bytes",
            stat: "Average",
            threshold: 1073741824,
            comparison: "LessThan",
            period: 300,
            evaluationPeriods: 1,
            description: "VMSS Available Memory is low (<1GB)"
        }
    ],
    acr: [
        {
            nameSuffix: "Failed-Pull-Count",
            namespace: "Microsoft.ContainerRegistry/registries",
            metricName: "FailedPullCount",
            stat: "Total",
            threshold: 10,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "ACR image pull failures are high (>10)"
        },
        {
            nameSuffix: "Failed-Push-Count",
            namespace: "Microsoft.ContainerRegistry/registries",
            metricName: "FailedPushCount",
            stat: "Total",
            threshold: 5,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "ACR image push failures are high (>5)"
        }
    ],
    lb: [
        {
            nameSuffix: "Low-Dip-Availability",
            namespace: "Microsoft.Network/loadBalancers",
            metricName: "DipAvailability",
            stat: "Average",
            threshold: 95,
            comparison: "LessThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Load Balancer dip availability is low (<95%)"
        },
        {
            nameSuffix: "Unhealthy-Host-Count",
            namespace: "Microsoft.Network/applicationGateways",
            metricName: "UnhealthyHostCount",
            stat: "Average",
            threshold: 0,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Application Gateway unhealthy host count is high (>0)"
        }
    ],
    functions: [
        {
            nameSuffix: "High-5xx-Errors",
            namespace: "Microsoft.Web/sites",
            metricName: "Http5xx",
            stat: "Total",
            threshold: 10,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Function App HTTP 5xx errors are high (>10)"
        },
        {
            nameSuffix: "High-4xx-Errors",
            namespace: "Microsoft.Web/sites",
            metricName: "Http4xx",
            stat: "Total",
            threshold: 50,
            comparison: "GreaterThan",
            period: 300,
            evaluationPeriods: 1,
            description: "Function App HTTP 4xx errors are high (>50)"
        }
    ]
};

export async function provisionDefaultAlarms(
    userId: string,
    tenantId: string | undefined,
    subscriptionId: string | undefined,
    clientId: string | undefined,
    clientSecret: string | undefined,
    alarmActions: string[] = []
): Promise<ProvisionResult> {
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        throw new Error("Missing Azure credentials to provision default alarms");
    }

    const inventory = await getResources(userId, "all", tenantId, subscriptionId, clientId, clientSecret);
    const existingRes = await getAzureAlertRules(tenantId, subscriptionId, clientId, clientSecret, "all");
    const existingNames = new Set(existingRes.alarms.map((a: any) => a.name));

    const results: any[] = [];
    let created = 0;
    let failed = 0;
    let skipped = 0;

    const tasks: { region: string; params: any; service: string; resourceId: string }[] = [];
    const services = ["vm", "sql", "storage", "vmss", "acr", "lb", "functions"];

    for (const service of services) {
        let resources = (inventory as any)[service] || [];
        if (service === "vm" && !resources.length) resources = (inventory as any)["ec2"] || [];
        if (service === "sql" && !resources.length) resources = (inventory as any)["rds"] || [];
        if (service === "storage" && !resources.length) resources = (inventory as any)["s3"] || [];
        if (service === "vmss" && !resources.length) resources = (inventory as any)["autoscaling"] || [];
        if (service === "acr" && !resources.length) resources = (inventory as any)["ecr"] || [];
        if (service === "lb" && !resources.length) resources = (inventory as any)["alb"] || [];
        if (service === "functions" && !resources.length) {
            const allLambda = (inventory as any)["lambda"] || [];
            resources = allLambda.filter((r: any) => {
                const idLower = (r.id || "").toLowerCase();
                const typeLower = (r.type || "").toLowerCase();
                return idLower.includes("microsoft.web/sites") || typeLower.includes("functionapp");
            });
        }

        const templates = AZURE_DEFAULT_ALARM_TEMPLATES[service] || [];

        for (const res of resources) {
            const resourceId = res.id || res.arn || res.name;
            if (!resourceId) continue;

            const region = res.region || res.location || "eastus";

            for (const template of templates) {
                if (service === "lb" && !resourceId.toLowerCase().includes(template.namespace.toLowerCase())) {
                    continue;
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
                    namespace: template.namespace,
                    actions: alarmActions
                };

                tasks.push({ region, params: alarmParams, service, resourceId });
            }
        }
    }

    const provisionResults = await Promise.allSettled(
        tasks.map(t => putAzureMetricAlert(tenantId, subscriptionId, clientId, clientSecret, t.region, t.params.name, t.params))
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

    return {
        created,
        failed,
        skipped,
        total: tasks.length + skipped,
        details: results
    };
}

export async function previewDefaultAlarms(
    userId: string,
    tenantId: string | undefined,
    subscriptionId: string | undefined,
    clientId: string | undefined,
    clientSecret: string | undefined
): Promise<any> {
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        throw new Error("Missing Azure credentials to preview default alarms");
    }

    const inventory = await getResources(userId, "all", tenantId, subscriptionId, clientId, clientSecret);
    const existingRes = await getAzureAlertRules(tenantId, subscriptionId, clientId, clientSecret, "all");
    const existingNames = new Set(existingRes.alarms.map((a: any) => a.name));

    const preview: Record<string, { count: number; resources: number }> = {};
    let totalAlarms = 0;
    let totalResources = 0;

    const services = ["vm", "sql", "storage", "vmss", "acr", "lb", "functions"];

    for (const service of services) {
        let resources = (inventory as any)[service] || [];
        if (service === "vm" && !resources.length) resources = (inventory as any)["ec2"] || [];
        if (service === "sql" && !resources.length) resources = (inventory as any)["rds"] || [];
        if (service === "storage" && !resources.length) resources = (inventory as any)["s3"] || [];
        if (service === "vmss" && !resources.length) resources = (inventory as any)["autoscaling"] || [];
        if (service === "acr" && !resources.length) resources = (inventory as any)["ecr"] || [];
        if (service === "lb" && !resources.length) resources = (inventory as any)["alb"] || [];
        if (service === "functions" && !resources.length) {
            const allLambda = (inventory as any)["lambda"] || [];
            resources = allLambda.filter((r: any) => {
                const idLower = (r.id || "").toLowerCase();
                const typeLower = (r.type || "").toLowerCase();
                return idLower.includes("microsoft.web/sites") || typeLower.includes("functionapp");
            });
        }

        const templates = AZURE_DEFAULT_ALARM_TEMPLATES[service] || [];

        let alarmsForService = 0;
        let resourcesWithAlarms = 0;

        for (const res of resources) {
            let hasNewAlarm = false;
            const resourceId = res.id || res.arn || res.name;
            if (!resourceId) continue;

            for (const template of templates) {
                if (service === "lb" && !resourceId.toLowerCase().includes(template.namespace.toLowerCase())) {
                    continue;
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
