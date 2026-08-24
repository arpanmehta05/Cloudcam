import {
    CloudWatchClient,
    DescribeAlarmsCommand,
    StateValue,
    PutMetricAlarmCommand,
    DeleteAlarmsCommand,
    EnableAlarmActionsCommand,
    DisableAlarmActionsCommand,
    ComparisonOperator,
    Statistic,
} from "@aws-sdk/client-cloudwatch";
import { getClientConfig } from "./client-factory";
import { getEnabledDiscoveryRegions } from "./resources.provider";

const ALARM_REGIONS = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-central-1", "eu-west-3", "eu-north-1",
    "ap-south-1", "ap-south-2", "ap-southeast-1", "ap-southeast-2",
    "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
    "sa-east-1", "ca-central-1",
];

type MetricAlarmParams = {
    name: string;
    metric: string;
    namespace: string;
    threshold: number;
    comparison: string;
    period: number;
    evaluationPeriods: number;
    statistic?: string;
    dimensions?: { Name: string; Value: string }[];
    actions?: string[];
};

function buildPutMetricAlarmCommand(params: MetricAlarmParams) {
    let dimensions = params.dimensions;
    if (dimensions) {
        const serviceNameDim = dimensions.find(d => d.Name === "ServiceName");
        if (serviceNameDim && serviceNameDim.Value.includes(":")) {
            const parts = serviceNameDim.Value.split(":");
            const clusterName = parts[0];
            const serviceName = parts[1];
            dimensions = dimensions.filter(d => d.Name !== "ServiceName");
            dimensions.push({ Name: "ClusterName", Value: clusterName });
            dimensions.push({ Name: "ServiceName", Value: serviceName });
        }
    }

    return new PutMetricAlarmCommand({
        AlarmName: params.name,
        MetricName: params.metric,
        Namespace: params.namespace,
        Statistic: (params.statistic as Statistic) || "Average",
        Period: params.period,
        EvaluationPeriods: params.evaluationPeriods,
        Threshold: params.threshold,
        ComparisonOperator: params.comparison as ComparisonOperator,
        Dimensions: dimensions,
        AlarmActions: params.actions,
        TreatMissingData: "notBreaching",
    });
}

export async function getCloudWatchAlarms(
    workspaceId: string,
    region: string | undefined,
    roleArn?: string,
    externalId?: string
) {
    // If a specific region is requested, query only that region.
    // Otherwise scan active regions dynamically and aggregate.
    // "all" is a special identifier from the frontend for Global view.
    const isGlobal = !region || region === "all";
    let regions: string[];

    if (isGlobal) {
        try {
            regions = await getEnabledDiscoveryRegions(workspaceId, roleArn, externalId);
            if (regions.length === 0) {
                regions = ["us-east-1"]; // Fallback to avoid empty scan
            }
        } catch (e) {
            console.warn("[Alarms] Failed to fetch enabled regions, falling back to static list:", e);
            regions = ALARM_REGIONS;
        }
    } else {
        regions = [region];
    }

    const regionResults = await Promise.allSettled(
        regions.map(r => fetchAlarmsInRegion(workspaceId, r, roleArn, externalId))
    );

    const alarms: any[] = [];
    for (const result of regionResults) {
        if (result.status === "fulfilled") {
            alarms.push(...result.value);
        }
    }

    // Deduplicate by ARN in case of cross-region overlap
    const seen = new Set<string>();
    const unique = alarms.filter(a => {
        if (a.arn && seen.has(a.arn)) return false;
        if (a.arn) seen.add(a.arn);
        return true;
    });

    const counts = {
        total: unique.length,
        alarm: unique.filter(a => a.state === StateValue.ALARM).length,
        ok: unique.filter(a => a.state === StateValue.OK).length,
        insufficient: unique.filter(a => a.state === StateValue.INSUFFICIENT_DATA).length,
    };

    return { alarms: unique, counts };
}

async function fetchAlarmsInRegion(
    workspaceId: string, region: string, roleArn?: string, externalId?: string
): Promise<any[]> {
    const clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new CloudWatchClient(clientConfig);

    const alarms: any[] = [];
    let nextToken: string | undefined;

    do {
        const response = await client.send(new DescribeAlarmsCommand({
            MaxRecords: 100,
            NextToken: nextToken,
        }));

        (response.MetricAlarms || []).forEach(alarm => {
            alarms.push({
                name: alarm.AlarmName || "Unknown",
                arn: alarm.AlarmArn,
                state: alarm.StateValue || StateValue.INSUFFICIENT_DATA,
                namespace: alarm.Namespace || "-",
                metric: alarm.MetricName || "-",
                reason: alarm.StateReason || "",
                updatedAt: alarm.StateUpdatedTimestamp?.toISOString() || null,
                region,
                type: "metric",
                actionsEnabled: alarm.ActionsEnabled ?? false,
                actions: alarm.AlarmActions || [],
                comparison: alarm.ComparisonOperator,
                threshold: alarm.Threshold,
                period: alarm.Period,
                evaluationPeriods: alarm.EvaluationPeriods,
                statistic: alarm.Statistic,
                dimensions: alarm.Dimensions || [],
            });
        });

        (response.CompositeAlarms || []).forEach(alarm => {
            alarms.push({
                name: alarm.AlarmName || "Unknown",
                arn: alarm.AlarmArn,
                state: alarm.StateValue || StateValue.INSUFFICIENT_DATA,
                namespace: "Composite",
                metric: "-",
                reason: alarm.StateReason || "",
                updatedAt: alarm.StateUpdatedTimestamp?.toISOString() || null,
                region,
                type: "composite",
                actionsEnabled: alarm.ActionsEnabled ?? false,
                actions: alarm.AlarmActions || [],
            });
        });

        nextToken = response.NextToken;
    } while (nextToken);

    return alarms;
}

export async function createAlarm(
    workspaceId: string,
    region: string,
    params: MetricAlarmParams,
    roleArn?: string,
    externalId?: string
) {
    const clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new CloudWatchClient(clientConfig);

    await client.send(buildPutMetricAlarmCommand(params));
    return { success: true, message: `Alarm ${params.name} created successfully` };
}

export async function updateAlarm(
    workspaceId: string,
    region: string,
    alarmName: string,
    params: Omit<MetricAlarmParams, "name"> & { name?: string },
    roleArn?: string,
    externalId?: string
) {
    const clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new CloudWatchClient(clientConfig);
    const resolvedName = params.name || alarmName;

    await client.send(buildPutMetricAlarmCommand({
        ...params,
        name: resolvedName,
    }));

    return { success: true, message: `Alarm ${resolvedName} updated successfully` };
}

export async function toggleAlarmActions(
    workspaceId: string,
    region: string,
    alarmName: string,
    enabled: boolean,
    roleArn?: string,
    externalId?: string
) {
    const clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new CloudWatchClient(clientConfig);
    const AlarmNames = [alarmName];

    if (enabled) {
        await client.send(new EnableAlarmActionsCommand({ AlarmNames }));
    } else {
        await client.send(new DisableAlarmActionsCommand({ AlarmNames }));
    }

    return {
        success: true,
        enabled,
        message: `Alarm actions ${enabled ? "enabled" : "disabled"} for ${alarmName}`,
    };
}

export async function deleteAlarm(
    workspaceId: string,
    region: string,
    alarmName: string,
    roleArn?: string,
    externalId?: string
) {
    const clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new CloudWatchClient(clientConfig);

    const command = new DeleteAlarmsCommand({
        AlarmNames: [alarmName],
    });

    await client.send(command);
    return { success: true, message: `Alarm ${alarmName} deleted successfully` };
}
