// Alarm Metadata Service
// Fetches AWS resources dynamically for the alarm creation modal.

import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { SNSClient, ListTopicsCommand } from "@aws-sdk/client-sns";
import { ECSClient, ListClustersCommand, ListServicesCommand } from "@aws-sdk/client-ecs";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";
import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { SERVICE_REGISTRY, CloudWatchMetricDefinition } from "../../../../data/service-registry";
import { getClientConfig } from "../../providers/client-factory";

// Services that map to queryable AWS resources for alarm dimensions.
const RESOURCE_SERVICES = [
    "ec2", "rds", "lambda", "ecs", "dynamodb", "sqs", "alb", "s3",
] as const;

type ResourceService = (typeof RESOURCE_SERVICES)[number];

export interface AlarmResource {
    label: string;
    value: string;
}

// Map service key to the CloudWatch dimension name used for alarms.
function getDimensionKey(service: string): string {
    const dimMap: Record<string, string> = {
        ec2: "InstanceId",
        rds: "DBInstanceIdentifier",
        lambda: "FunctionName",
        ecs: "ServiceName",
        dynamodb: "TableName",
        sqs: "QueueName",
        alb: "LoadBalancer",
        s3: "BucketName",
    };
    return dimMap[service] || "ResourceId";
}

// Map service key to the CloudWatch namespace.
function getNamespace(service: string): string {
    const nsMap: Record<string, string> = {
        ec2: "AWS/EC2",
        rds: "AWS/RDS",
        lambda: "AWS/Lambda",
        ecs: "AWS/ECS",
        dynamodb: "AWS/DynamoDB",
        sqs: "AWS/SQS",
        alb: "AWS/ApplicationELB",
        s3: "AWS/S3",
    };
    return nsMap[service] || "";
}

// Get recommended metrics for a service from the registry.
function getMetricsForService(service: string): CloudWatchMetricDefinition[] {
    const config = SERVICE_REGISTRY[service];
    return config?.metrics || [];
}

export interface AlarmServiceInfo {
    key: string;
    label: string;
    namespace: string;
    dimensionKey: string;
    hasResources: boolean;
    resourceCount: number;
    metrics: CloudWatchMetricDefinition[];
}

/**
 * Get all services available for alarm creation with their metadata.
 */
export async function getAlarmServices(
    workspaceId: string,
    region: string,
    roleArn?: string,
    externalId?: string
): Promise<AlarmServiceInfo[]> {
    const promises = RESOURCE_SERVICES.map(async (service) => {
        try {
            const resources = await fetchResourcesForService(workspaceId, service, region, roleArn, externalId);
            return {
                key: service,
                label: SERVICE_REGISTRY[service]?.displayName || service.toUpperCase(),
                namespace: getNamespace(service),
                dimensionKey: getDimensionKey(service),
                hasResources: resources.length > 0,
                resourceCount: resources.length,
                metrics: getMetricsForService(service),
            };
        } catch (err: any) {
            console.error(`[AlarmMetadata] Error fetching resources for ${service} in ${region}:`, err?.message || err);
            return {
                key: service,
                label: SERVICE_REGISTRY[service]?.displayName || service.toUpperCase(),
                namespace: getNamespace(service),
                dimensionKey: getDimensionKey(service),
                hasResources: false,
                resourceCount: 0,
                metrics: getMetricsForService(service),
            };
        }
    });

    return Promise.all(promises);
}

/**
 * Fetch resources for a specific service in a region.
 */
export async function getAlarmResources(
    workspaceId: string,
    service: string,
    region: string,
    roleArn?: string,
    externalId?: string
): Promise<{ resources: AlarmResource[]; dimensionKey: string; namespace: string }> {
    const resources = await fetchResourcesForService(workspaceId, service, region, roleArn, externalId);
    return {
        resources,
        dimensionKey: getDimensionKey(service),
        namespace: getNamespace(service),
    };
}

/**
 * Fetch all SNS topics across regions.
 */
export async function getSnsTopics(
    workspaceId: string,
    region: string,
    roleArn?: string,
    externalId?: string
): Promise<AlarmResource[]> {
    const topics: AlarmResource[] = [];
    const seen = new Set<string>();

    try {
        const cfg = await getClientConfig(workspaceId, region, roleArn, externalId);
        const client = new SNSClient(cfg);
        let nextToken: string | undefined;

        do {
            const res = await client.send(new ListTopicsCommand({ NextToken: nextToken }));
            res.Topics?.forEach(t => {
                const arn = t.TopicArn || "";
                if (arn && !seen.has(arn)) {
                    seen.add(arn);
                    const name = arn.split(":").pop() || arn;
                    topics.push({ label: name, value: arn });
                }
            });
            nextToken = res.NextToken;
        } while (nextToken);
    } catch (e: any) {
        console.warn(`[AlarmMetadata] SNS error in ${region}:`, e?.message || e);
    }

    return topics;
}

// ─── Internal: Per-service resource fetchers ───

async function fetchResourcesForService(
    workspaceId: string,
    service: string,
    region: string,
    roleArn?: string,
    externalId?: string
): Promise<AlarmResource[]> {
    if (!RESOURCE_SERVICES.includes(service as ResourceService)) {
        return [];
    }

    const cfg = await getClientConfig(workspaceId, region, roleArn, externalId);

    switch (service) {
        case "ec2": return fetchEc2Instances(cfg);
        case "rds": return fetchRdsInstances(cfg);
        case "lambda": return fetchLambdaFunctions(cfg);
        case "ecs": return fetchEcsServices(cfg);
        case "dynamodb": return fetchDynamoDBTables(cfg);
        case "sqs": return fetchSqsQueues(cfg);
        case "alb": return fetchAlbs(cfg);
        case "s3": return fetchS3Buckets(cfg);
        default: return [];
    }
}

async function fetchEc2Instances(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new EC2Client(cfg);
        const items: AlarmResource[] = [];
        let nextToken: string | undefined;

        do {
            const res = await client.send(new DescribeInstancesCommand({ NextToken: nextToken }));
            res.Reservations?.forEach(r => {
                r.Instances?.forEach(inst => {
                    const tags = inst.Tags || [];
                    const name = tags.find((t: any) => t.Key === "Name")?.Value;
                    const id = inst.InstanceId;
                    if (id) {
                        items.push({
                            label: name ? `${name} (${id})` : id,
                            value: id,
                        });
                    }
                });
            });
            nextToken = res.NextToken;
        } while (nextToken);

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] EC2 error:", e?.message || e);
        return [];
    }
}

async function fetchRdsInstances(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new RDSClient(cfg);
        const items: AlarmResource[] = [];
        let marker: string | undefined;

        do {
            const res = await client.send(new DescribeDBInstancesCommand({ Marker: marker, MaxRecords: 100 }));
            res.DBInstances?.forEach(db => {
                const id = db.DBInstanceIdentifier;
                if (id) {
                    items.push({ label: id, value: id });
                }
            });
            marker = res.Marker;
        } while (marker);

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] RDS error:", e?.message || e);
        return [];
    }
}

async function fetchLambdaFunctions(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new LambdaClient(cfg);
        const items: AlarmResource[] = [];
        let marker: string | undefined;

        do {
            const res = await client.send(new ListFunctionsCommand({ Marker: marker, MaxItems: 100 }));
            res.Functions?.forEach(fn => {
                const name = fn.FunctionName;
                if (name) {
                    items.push({ label: name, value: name });
                }
            });
            marker = res.NextMarker;
        } while (marker);

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] Lambda error:", e?.message || e);
        return [];
    }
}

async function fetchEcsServices(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new ECSClient(cfg);
        const items: AlarmResource[] = [];

        const clustersRes = await client.send(new ListClustersCommand({}));
        for (const clusterArn of clustersRes.clusterArns || []) {
            const clusterName = clusterArn.split("/").pop() || clusterArn;
            let svcToken: string | undefined;

            do {
                const res = await client.send(new ListServicesCommand({ cluster: clusterArn, nextToken: svcToken }));
                res.serviceArns?.forEach(arn => {
                    const name = arn.split("/").pop() || arn;
                    items.push({ label: `${clusterName}/${name}`, value: `${clusterName}:${name}` });
                });
                svcToken = res.nextToken;
            } while (svcToken);
        }

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] ECS error:", e?.message || e);
        return [];
    }
}

async function fetchDynamoDBTables(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new DynamoDBClient(cfg);
        const items: AlarmResource[] = [];
        let nextToken: string | undefined;

        do {
            const res = await client.send(new ListTablesCommand({ ExclusiveStartTableName: nextToken }));
            res.TableNames?.forEach(name => {
                if (name) items.push({ label: name, value: name });
                nextToken = res.LastEvaluatedTableName;
            });
        } while (nextToken);

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] DynamoDB error:", e?.message || e);
        return [];
    }
}

async function fetchSqsQueues(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new SQSClient(cfg);
        const items: AlarmResource[] = [];

        const res = await client.send(new ListQueuesCommand({}));
        res.QueueUrls?.forEach(url => {
            const name = url.split("/").pop();
            if (name) items.push({ label: name, value: name });
        });

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] SQS error:", e?.message || e);
        return [];
    }
}

async function fetchAlbs(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new ElasticLoadBalancingV2Client(cfg);
        const items: AlarmResource[] = [];
        let marker: string | undefined;

        do {
            const res = await client.send(new DescribeLoadBalancersCommand({ Marker: marker }));
            res.LoadBalancers?.forEach(alb => {
                const arn = alb.LoadBalancerArn || "";
                const name = alb.LoadBalancerName;
                const suffix = arn.includes("loadbalancer/") ? arn.split("loadbalancer/")[1] : name;
                if (name && suffix) {
                    items.push({ label: name, value: suffix });
                }
                marker = res.NextMarker;
            });
        } while (marker);

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] ALB error:", e?.message || e);
        return [];
    }
}

async function fetchS3Buckets(cfg: any): Promise<AlarmResource[]> {
    try {
        const client = new S3Client(cfg);
        const items: AlarmResource[] = [];

        const res = await client.send(new ListBucketsCommand({}));
        res.Buckets?.forEach(bucket => {
            const name = bucket.Name;
            if (name) items.push({ label: name, value: name });
        });

        return items;
    } catch (e: any) {
        console.warn("[AlarmMetadata] S3 error:", e?.message || e);
        return [];
    }
}
