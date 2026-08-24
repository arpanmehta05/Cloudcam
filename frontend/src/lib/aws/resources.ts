// AWS Resource Discovery Helpers
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";

export async function getResourceInventory(
    workspaceId: string,
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
) {
    const config = await getClientConfig(workspaceId, region, roleArn, externalId);

    // Initializing clients
    const ec2Client = new EC2Client(config);
    const lambdaClient = new LambdaClient(config);
    const rdsClient = new RDSClient(config);
    const s3Client = new S3Client(config);

    // Fetch all in parallel
    const [ec2, lambda, rds, s3] = await Promise.allSettled([
        ec2Client.send(new DescribeInstancesCommand({})),
        lambdaClient.send(new ListFunctionsCommand({})),
        rdsClient.send(new DescribeDBInstancesCommand({})),
        s3Client.send(new ListBucketsCommand({}))
    ]);

    const inventory: any = {
        ec2: [],
        lambda: [],
        rds: [],
        s3: [],
        counts: { total: 0 }
    };

    // Process EC2
    if (ec2.status === "fulfilled") {
        ec2.value.Reservations?.forEach(res => {
            res.Instances?.forEach(inst => {
                const name = inst.Tags?.find(t => t.Key === "Name")?.Value || inst.InstanceId;
                inventory.ec2.push({
                    id: inst.InstanceId,
                    name,
                    state: inst.State?.Name,
                    type: inst.InstanceType,
                    launchTime: inst.LaunchTime
                });
            });
        });
    }

    // Process Lambda
    if (lambda.status === "fulfilled") {
        lambda.value.Functions?.forEach(fn => {
            inventory.lambda.push({
                name: fn.FunctionName,
                runtime: fn.Runtime,
                memory: fn.MemorySize,
                lastModified: fn.LastModified
            });
        });
    }

    // Process RDS
    if (rds.status === "fulfilled") {
        rds.value.DBInstances?.forEach(db => {
            inventory.rds.push({
                id: db.DBInstanceIdentifier,
                engine: db.Engine,
                status: db.DBInstanceStatus,
                class: db.DBInstanceClass
            });
        });
    }

    // Process S3
    if (s3.status === "fulfilled") {
        s3.value.Buckets?.forEach(bucket => {
            inventory.s3.push({
                name: bucket.Name,
                creationDate: bucket.CreationDate
            });
        });
    }

    inventory.counts = {
        ec2: inventory.ec2.length,
        lambda: inventory.lambda.length,
        rds: inventory.rds.length,
        s3: inventory.s3.length,
        total: inventory.ec2.length + inventory.lambda.length + inventory.rds.length + inventory.s3.length
    };

    return inventory;
}
