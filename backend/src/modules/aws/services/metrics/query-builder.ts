// Map service key → inventory key + dimension extraction
export const SERVICE_DIMENSION_MAP: Record<string, {
    inventoryKey: string;
    getDimensions: (item: any) => { Name: string; Value: string }[];
    getRegion: (item: any) => string | undefined;
}> = {
    ec2: {
        inventoryKey: "ec2",
        getDimensions: (item) => {
            const id = item.id || item.instanceId || item.resourceId;
            if (!id) return [];
            return [{ Name: "InstanceId", Value: id }];
        },
        getRegion: (item) => item.region,
    },
    lambda: {
        inventoryKey: "lambda",
        getDimensions: (item) => [{ Name: "FunctionName", Value: item.name }],
        getRegion: (item) => item.region,
    },
    rds: {
        inventoryKey: "rds",
        getDimensions: (item) => [{ Name: "DBInstanceIdentifier", Value: item.id }],
        getRegion: (item) => item.region,
    },
    amplify: {
        inventoryKey: "amplify",
        getDimensions: (item) => [{ Name: "App", Value: item.id }],
        getRegion: (item) => item.region,
    },
    dynamodb: {
        inventoryKey: "dynamodb",
        getDimensions: (item) => [{ Name: "TableName", Value: item.name }],
        getRegion: (item) => item.region,
    },
    sqs: {
        inventoryKey: "sqs",
        getDimensions: (item) => [{ Name: "QueueName", Value: item.name }],
        getRegion: (item) => item.region,
    },
    alb: {
        inventoryKey: "alb",
        getDimensions: (item) => [{ Name: "LoadBalancer", Value: item.id }],
        getRegion: (item) => item.region,
    },
    ebs: {
        inventoryKey: "ebs",
        getDimensions: (item) => [{ Name: "VolumeId", Value: item.id }],
        getRegion: (item) => item.region,
    },
    eks: {
        inventoryKey: "eks",
        getDimensions: (item) => [
            { Name: "ClusterName", Value: item.name },
            { Name: "Namespace", Value: "kube-system" }
        ],
        getRegion: (item) => item.region,
    },
    autoscaling: {
        inventoryKey: "autoscaling",
        getDimensions: (item) => [{ Name: "AutoScalingGroupName", Value: item.name }],
        getRegion: (item) => item.region,
    },
    elasticache: {
        inventoryKey: "elasticache",
        getDimensions: (item) => [{ Name: "CacheClusterId", Value: item.id }],
        getRegion: (item) => item.region,
    },
    redshift: {
        inventoryKey: "redshift",
        getDimensions: (item) => [{ Name: "ClusterIdentifier", Value: item.id }],
        getRegion: (item) => item.region,
    },
    cloudfront: {
        inventoryKey: "cloudfront",
        getDimensions: (item) => [
            { Name: "DistributionId", Value: item.id },
            { Name: "Region", Value: "Global" },
        ],
        getRegion: () => "us-east-1",
    },
    efs: {
        inventoryKey: "efs",
        getDimensions: (item) => [{ Name: "FileSystemId", Value: item.id }],
        getRegion: (item) => item.region,
    },
    kinesis: {
        inventoryKey: "kinesis",
        getDimensions: (item) => [{ Name: "StreamName", Value: item.name }],
        getRegion: (item) => item.region,
    },
    sns: {
        inventoryKey: "sns",
        getDimensions: (item) => [{ Name: "TopicName", Value: item.name }],
        getRegion: (item) => item.region,
    },
    eventbridge: {
        inventoryKey: "eventbridge",
        getDimensions: (item) => [{ Name: "RuleName", Value: item.name }],
        getRegion: (item) => item.region,
    },
    stepfunctions: {
        inventoryKey: "stepfunctions",
        getDimensions: (item) => [{ Name: "StateMachineArn", Value: item.arn }],
        getRegion: (item) => item.region,
    },
    waf: {
        inventoryKey: "waf",
        getDimensions: (item) => [
            { Name: "WebACL", Value: item.name },
            { Name: "Region", Value: item.region || "us-east-1" },
        ],
        getRegion: (item) => item.region,
    },
    apigateway: {
        inventoryKey: "apigateway",
        getDimensions: (item) => [
            { Name: "ApiName", Value: item.name },
            { Name: "Stage", Value: "$default" }
        ],
        getRegion: (item) => item.region,
    },
    security: {
        inventoryKey: "waf",
        getDimensions: (item) => [
            { Name: "WebACL", Value: item.name },
            { Name: "Region", Value: item.region || "us-east-1" },
        ],
        getRegion: (item) => item.region || "us-east-1",
    },
    eip: {
        inventoryKey: "eip",
        getDimensions: (item) => [{ Name: "PublicIp", Value: item.publicIp }],
        getRegion: (item) => item.region,
    },
    sg: {
        inventoryKey: "sg",
        getDimensions: (item) => [{ Name: "GroupId", Value: item.id }],
        getRegion: (item) => item.region,
    },
    tg: {
        inventoryKey: "tg",
        getDimensions: (item) => {
            const dims = [{ Name: "TargetGroup", Value: item.id }];
            if (item.loadBalancer) {
                dims.push({ Name: "LoadBalancer", Value: item.loadBalancer });
            }
            return dims;
        },
        getRegion: (item) => item.region,
    },
};
