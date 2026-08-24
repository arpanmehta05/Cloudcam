import { getResourceInventory } from "../../providers/resources.provider";
import { createAlarm, getCloudWatchAlarms } from "../../providers/alarms.provider";
import { DEFAULT_ALARM_TEMPLATES, AlarmTemplate } from "../../../../data/default-alarms";

export interface ProvisionResult {
    created: number;
    failed: number;
    skipped: number;
    total: number;
    details: any[];
}

export async function provisionDefaultAlarms(
    userId: string,
    roleArn: string | undefined,
    externalId: string | undefined,
    alarmActions: string[] = []
): Promise<ProvisionResult> {
    const inventory = await getResourceInventory(userId, "us-east-1", roleArn, externalId);

    // Fetch existing rabbittwatch alarms to avoid duplicates
    const existingRes = await getCloudWatchAlarms(userId, undefined, roleArn, externalId);
    const existingNames = new Set(existingRes.alarms.map((a: any) => a.name));

    const results: any[] = [];
    let created = 0;
    let failed = 0;
    let skipped = 0;

    const tasks: { region: string; params: any; service: string; resourceId: string }[] = [];

    // Map inventory resources to alarm templates
    const services = ["ec2", "lambda", "rds", "ecs", "amplify", "dynamodb", "sqs", "alb"];

    for (const service of services) {
        const resources = (inventory as any)[service] || [];
        const templates = DEFAULT_ALARM_TEMPLATES[service] || [];

        for (const res of resources) {
            const resourceId = res.id || res.name || res.arn || res.url;
            const region = res.region || "us-east-1";

            for (const template of templates) {
                const alarmName = `rabbittwatch-${service}-${template.nameSuffix}-${resourceId}`.substring(0, 255);

                if (existingNames.has(alarmName)) {
                    skipped++;
                    results.push({ name: alarmName, status: "skipped", reason: "Already exists" });
                    continue;
                }

                // Handle dynamic threshold for Lambda Duration (80% of timeout)
                let threshold = template.threshold;
                if (service === "lambda" && template.metricName === "Duration" && res.timeout) {
                    threshold = Math.floor(res.timeout * 1000 * 0.8);
                }

                const alarmParams: any = {
                    name: alarmName,
                    metric: template.metricName,
                    namespace: template.namespace,
                    threshold: threshold,
                    comparison: template.comparison,
                    period: template.period,
                    evaluationPeriods: template.evaluationPeriods,
                    statistic: template.stat,
                    dimensions: template.dimensionKey ? [{ Name: template.dimensionKey, Value: resourceId }] : [],
                    actions: alarmActions
                };

                // Special handling for ALB dimension
                if (service === "alb" && template.dimensionKey === "LoadBalancer") {
                    alarmParams.dimensions = [{ Name: "LoadBalancer", Value: res.id }];
                }

                // Special handling for ECS dimension
                if (service === "ecs") {
                    alarmParams.dimensions = [
                        { Name: "ClusterName", Value: res.cluster },
                        { Name: "ServiceName", Value: res.name }
                    ];
                }

                tasks.push({ region, params: alarmParams, service, resourceId });
            }
        }
    }

    // Process tasks
    const provisionResults = await Promise.allSettled(
        tasks.map(t => createAlarm(userId, t.region, t.params, roleArn, externalId))
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
    roleArn: string | undefined,
    externalId: string | undefined
): Promise<any> {
    const inventory = await getResourceInventory(userId, "us-east-1", roleArn, externalId);
    const existingRes = await getCloudWatchAlarms(userId, undefined, roleArn, externalId);
    const existingNames = new Set(existingRes.alarms.map((a: any) => a.name));

    const preview: Record<string, { count: number; resources: number }> = {};
    let totalAlarms = 0;
    let totalResources = 0;

    const services = ["ec2", "lambda", "rds", "ecs", "amplify", "dynamodb", "sqs", "alb"];

    for (const service of services) {
        const resources = (inventory as any)[service] || [];
        const templates = DEFAULT_ALARM_TEMPLATES[service] || [];

        let alarmsForService = 0;
        let resourcesWithAlarms = 0;

        for (const res of resources) {
            let hasNewAlarm = false;
            const resourceId = res.id || res.name || res.arn || res.url;

            for (const template of templates) {
                const alarmName = `rabbittwatch-${service}-${template.nameSuffix}-${resourceId}`.substring(0, 255);
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
