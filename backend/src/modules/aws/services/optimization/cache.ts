import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { S3Client, ListObjectsV2Command, ListObjectVersionsCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { OptimizationInsight } from "../../models/optimization-cache.model";
import { getClientConfig, DEFAULT_REGION } from "../../providers/client-factory";

export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
export const REVALIDATION_DRIFT_THRESHOLD = 0.20; // 20% score change blocks execution

export async function validateInsight(
    insightId: string,
    userId: string,
    workspaceId: string,
    roleArn?: string,
    externalId?: string,
    options?: { forceEmptyDelete?: boolean }
): Promise<{ valid: boolean; reason?: string; updatedScore?: number; warnings?: string[]; requiresForceEmptyDelete?: boolean }> {
    const insight = await OptimizationInsight.findOne({ _id: insightId, userId });
    if (!insight) return { valid: false, reason: "Insight not found" };

    // For advisory actions (Savings Plan, RI purchase), skip drift detection
    if (insight.type === "savings_plan" || insight.type === "reserved_instance") {
        insight.lastValidatedAt = new Date();
        await insight.save();
        return { valid: true };
    }

    // For EC2-based actions, verify the resource still exists and hasn't changed
    try {
        const clientConfig = await getClientConfig(
            workspaceId,
            insight.region || DEFAULT_REGION,
            roleArn,
            externalId
        );
        const ec2 = new EC2Client(clientConfig);

        if (insight.type === "rightsizing") {
            const response = await ec2.send(
                new DescribeInstancesCommand({ InstanceIds: [insight.resourceId] })
            );
            const instance = response.Reservations?.[0]?.Instances?.[0];

            if (!instance) {
                insight.stale = true;
                await insight.save();
                return { valid: false, reason: "Instance no longer exists" };
            }

            if (instance.State?.Name !== "running") {
                insight.stale = true;
                await insight.save();
                return { valid: false, reason: `Instance is ${instance.State?.Name}, not running` };
            }

            // Check if instance type has already been changed
            const currentType = instance.InstanceType;
            const recommendedType = insight.metadata?.recommendedType;
            if (currentType === recommendedType) {
                insight.stale = true;
                await insight.save();
                return { valid: false, reason: "Instance has already been resized to the recommended type" };
            }
        }

        if (insight.type === "orphaned_s3") {
            // Resolve the actual bucket region to avoid PermanentRedirect errors.
            let s3: S3Client;
            try {
                const probeS3 = new S3Client({ ...clientConfig, region: "us-east-1" });
                const locationResult = await probeS3.send(new GetBucketLocationCommand({ Bucket: insight.resourceId }));
                const bucketRegion = locationResult.LocationConstraint || "us-east-1";
                s3 = new S3Client({ ...clientConfig, region: bucketRegion });
            } catch (err) {
                console.warn(`[validateOpportunity] Could not resolve region for bucket "${insight.resourceId}"; using default. Reason: ${(err as Error).message}`);
                s3 = new S3Client(clientConfig);
            }
            const listed = await s3.send(new ListObjectsV2Command({
                Bucket: insight.resourceId,
                MaxKeys: 1,
            }));

            const versions = await s3.send(new ListObjectVersionsCommand({
                Bucket: insight.resourceId,
                MaxKeys: 1,
            }));

            const hasObjects = (listed.KeyCount ?? 0) > 0;
            const hasVersions = (versions.Versions?.length ?? 0) > 0;
            const hasDeleteMarkers = (versions.DeleteMarkers?.length ?? 0) > 0;

            if (hasObjects || hasVersions || hasDeleteMarkers) {
                if (options?.forceEmptyDelete) {
                    insight.lastValidatedAt = new Date();
                    await insight.save();
                    return {
                        valid: true,
                        warnings: ["Force-empty-delete requested for non-empty bucket. This is a high-risk irreversible action."],
                        requiresForceEmptyDelete: true,
                    };
                }
                return {
                    valid: false,
                    reason: "Bucket is not empty. Remove objects, object versions, and delete markers before deletion.",
                    requiresForceEmptyDelete: true,
                };
            }
        }

        if (insight.actionId?.startsWith("dynamodb-") || insight.type?.toString() === "dynamodb-autoscale") {
            const { DynamoDBClient, DescribeTableCommand } = await import("@aws-sdk/client-dynamodb");
            const db = new DynamoDBClient(clientConfig);
            try {
                await db.send(new DescribeTableCommand({ TableName: insight.resourceId }));
            } catch (err: any) {
                if (err.name === "ResourceNotFoundException") {
                    insight.stale = true;
                    await insight.save();
                    return { valid: false, reason: "DynamoDB table no longer exists" };
                }
                throw err;
            }
        }

        if (insight.actionId?.startsWith("apigateway-")) {
            const { APIGatewayClient, GetRestApiCommand } = await import("@aws-sdk/client-api-gateway");
            const apig = new APIGatewayClient(clientConfig);
            try {
                await apig.send(new GetRestApiCommand({ restApiId: insight.resourceId }));
            } catch (err: any) {
                if (err.name === "NotFoundException") {
                    insight.stale = true;
                    await insight.save();
                    return { valid: false, reason: "API Gateway REST API no longer exists" };
                }
                throw err;
            }
        }

        if (insight.actionId?.startsWith("ecr-")) {
            const { ECRClient, DescribeRepositoriesCommand } = await import("@aws-sdk/client-ecr");
            const ecr = new ECRClient(clientConfig);
            try {
                await ecr.send(new DescribeRepositoriesCommand({ repositoryNames: [insight.resourceId] }));
            } catch (err: any) {
                if (err.name === "RepositoryNotFoundException") {
                    insight.stale = true;
                    await insight.save();
                    return { valid: false, reason: "ECR repository no longer exists" };
                }
                throw err;
            }
        }

        // Re-score: if score drifted by more than 20%, block execution
        const originalScore = insight.score;
        const scoreChange = 0; // placeholder for real recalculation

        if (Math.abs(scoreChange) > REVALIDATION_DRIFT_THRESHOLD * originalScore) {
            return {
                valid: false,
                reason: `Score has drifted by ${Math.round(scoreChange)}%. Please refresh recommendations.`,
                updatedScore: originalScore + scoreChange,
            };
        }

        insight.lastValidatedAt = new Date();
        await insight.save();
        return { valid: true };
    } catch (err: any) {
        return { valid: false, reason: `Validation failed: ${err.message}` };
    }
}
