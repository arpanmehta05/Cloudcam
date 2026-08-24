import { getCredentials } from "../../../store/workspace-credentials";
import { getClientConfig } from "../providers/client-factory";

export interface LiveActionSafetyResult {
  isDeletable: boolean;
  reason: string | null;
  helperAction: string | null;
  helperLabel: string | null;
  warning: string | null;
}

export async function checkLiveActionSafety(
  userId: string,
  resourceId: string,
  service: string,
  region: string
): Promise<LiveActionSafetyResult> {
  const creds = await getCredentials(userId, "aws");
  if (!creds?.roleArn || !creds?.externalId) {
    throw new Error("AWS credentials not connected");
  }

  const clientConfig = await getClientConfig(userId, region, creds.roleArn, creds.externalId);

  let isDeletable = true;
  let reason: string | null = null;
  let helperAction: string | null = null;
  let helperLabel: string | null = null;
  let warning: string | null = null;

  if (service === "s3") {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = new S3Client(clientConfig);
    try {
      const objects = await client.send(new ListObjectsV2Command({ Bucket: resourceId, MaxKeys: 1 }));
      if (objects.Contents && objects.Contents.length > 0) {
        isDeletable = false;
        reason = "S3 bucket is not empty. You must delete all objects inside it before deleting the bucket.";
        helperAction = "empty-bucket";
        helperLabel = "Empty Bucket";
      }
    } catch (err: any) {
      console.warn("[safety-check] S3 check failed:", err.message);
    }
  } else if (service === "cloudfront") {
    const { CloudFrontClient, GetDistributionConfigCommand } = await import("@aws-sdk/client-cloudfront");
    const client = new CloudFrontClient(clientConfig);
    try {
      const dist = await client.send(new GetDistributionConfigCommand({ Id: resourceId }));
      const enabled = dist.DistributionConfig?.Enabled;
      if (enabled) {
        isDeletable = false;
        reason = "CloudFront distribution is enabled. You must disable it first and wait for it to be deployed.";
        helperAction = "disable";
        helperLabel = "Disable Distribution";
      }
    } catch (err: any) {
      console.warn("[safety-check] CloudFront check failed:", err.message);
    }
  } else if (service === "rds") {
    const { RDSClient, DescribeDBInstancesCommand } = await import("@aws-sdk/client-rds");
    const client = new RDSClient(clientConfig);
    try {
      const instances = await client.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: resourceId }));
      const inst = instances.DBInstances?.[0];
      if (inst?.DeletionProtection) {
        isDeletable = false;
        reason = "RDS Deletion Protection is enabled. You must disable it before deleting the database.";
        helperAction = "disable-protection";
        helperLabel = "Disable Deletion Protection";
      }
    } catch (err: any) {
      console.warn("[safety-check] RDS check failed:", err.message);
    }
  } else if (service === "dynamodb") {
    const { DynamoDBClient, DescribeTableCommand } = await import("@aws-sdk/client-dynamodb");
    const client = new DynamoDBClient(clientConfig);
    try {
      const table = await client.send(new DescribeTableCommand({ TableName: resourceId }));
      if (table.Table?.DeletionProtectionEnabled) {
        isDeletable = false;
        reason = "DynamoDB Deletion Protection is enabled. You must disable it before deleting the table.";
        helperAction = "disable-protection";
        helperLabel = "Disable Deletion Protection";
      }
    } catch (err: any) {
      console.warn("[safety-check] DynamoDB check failed:", err.message);
    }
  } else if (service === "ec2") {
    const { EC2Client, DescribeInstanceAttributeCommand } = await import("@aws-sdk/client-ec2");
    const client = new EC2Client(clientConfig);
    try {
      const attr = await client.send(new DescribeInstanceAttributeCommand({ InstanceId: resourceId, Attribute: "disableApiTermination" }));
      if (attr.DisableApiTermination?.Value) {
        isDeletable = false;
        reason = "EC2 Termination Protection is enabled. You must disable it before terminating the instance.";
        helperAction = "disable-protection";
        helperLabel = "Disable Termination Protection";
      }
    } catch (err: any) {
      console.warn("[safety-check] EC2 check failed:", err.message);
    }
  }

  return {
    isDeletable,
    reason,
    helperAction,
    helperLabel,
    warning,
  };
}
