// Safety Validator — Pre-execution safety checks for infrastructure actions
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { ElasticLoadBalancingV2Client, DescribeTargetHealthCommand, DescribeTargetGroupsCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { S3Client, ListObjectsV2Command, ListObjectVersionsCommand } from "@aws-sdk/client-s3";
import { getClientConfig, DEFAULT_REGION } from "../../providers/client-factory";
import { ActionDefinition } from "../../../../data/action-registry";

export interface SafetyCheckResult {
    safe: boolean;
    warnings: string[];
    dependencyWarnings: string[];
    downtimeWarning?: string;
    blockers: string[]; // hard blockers that prevent execution
}

const ACTION_MODE = process.env.ACTION_MODE || "simulation";

export async function validateAction(
    actionDef: ActionDefinition,
    targets: { resourceId: string; region: string }[],
    userId: string,
    roleArn?: string,
    externalId?: string
): Promise<SafetyCheckResult> {
    const result: SafetyCheckResult = {
        safe: true,
        warnings: [],
        dependencyWarnings: [],
        blockers: [],
    };

    // ─── 1. Blast Radius Check ───
    if (targets.length > actionDef.blastRadiusLimit) {
        result.blockers.push(
            `Blast radius exceeded: ${targets.length} targets requested but limit is ${actionDef.blastRadiusLimit} for ${actionDef.riskLevel}-risk actions.`
        );
        result.safe = false;
    }

    // ─── 2. Simulation Mode Detection ───
    if (ACTION_MODE === "simulation") {
        result.warnings.push("Running in SIMULATION mode — actions will be logged but not executed against AWS.");
    }

    // ─── 3. Downtime Warning ───
    if (actionDef.downtimeWarning) {
        result.downtimeWarning = actionDef.downtimeWarning;
        result.warnings.push(`Downtime: ${actionDef.downtimeWarning}`);
    }

    // ─── 4. Snapshot Requirement ───
    if (actionDef.requiresSnapshot) {
        result.warnings.push("This action requires an EBS snapshot before proceeding. A snapshot will be created automatically.");
    }

    // ─── 5. EC2-specific checks ───
    if (actionDef.service === "ec2" && targets.length > 0) {
        try {
            const checks = await Promise.allSettled(
                targets.map((t) => checkEC2Dependencies(t.resourceId, t.region, userId, roleArn, externalId))
            );

            for (let i = 0; i < checks.length; i++) {
                if (checks[i].status === "fulfilled") {
                    const depResult = (checks[i] as PromiseFulfilledResult<EC2DependencyCheck>).value;

                    // Production tag check
                    if (depResult.isProduction) {
                        result.warnings.push(
                            `⚠️ ${targets[i].resourceId} has production tags (Environment: production). Proceed with extreme caution.`
                        );
                    }

                    // ALB/NLB dependency
                    if (depResult.behindLoadBalancer) {
                        result.dependencyWarnings.push(
                            `${targets[i].resourceId} is registered behind a load balancer. Stopping/terminating will affect traffic routing.`
                        );
                    }

                    // Auto Scaling Group
                    if (depResult.inAutoScalingGroup) {
                        result.dependencyWarnings.push(
                            `${targets[i].resourceId} is part of an Auto Scaling Group. ASG may launch a replacement automatically.`
                        );
                    }

                    // Elastic IP
                    if (depResult.hasElasticIp) {
                        result.dependencyWarnings.push(
                            `${targets[i].resourceId} has an Elastic IP. The IP will be disassociated if the instance is stopped.`
                        );
                    }
                }
            }
        } catch (err) {
            result.warnings.push("Could not fully validate EC2 dependencies. Proceed with caution.");
        }
    }

    // ─── 6. Critical-tier extra gate ───
    if (actionDef.id === "s3-delete-bucket" && targets.length > 0) {
        const checks = await Promise.allSettled(
            targets.map((t) => checkS3BucketContents(t.resourceId, t.region, userId, roleArn, externalId))
        );

        for (let i = 0; i < checks.length; i++) {
            if (checks[i].status === "fulfilled") {
                const content = (checks[i] as PromiseFulfilledResult<S3BucketContentCheck>).value;
                if (content.hasObjects || content.hasVersions || content.hasDeleteMarkers) {
                    result.warnings.push(
                        `Bucket ${targets[i].resourceId} is not empty. Standard delete will fail unless you use force-empty-delete with explicit confirmation.`
                    );
                }
            } else {
                result.warnings.push(`Could not verify whether bucket ${targets[i].resourceId} is empty.`);
            }
        }
    }

    // ─── 6. Critical-tier extra gate ───
    if (actionDef.riskLevel === "critical") {
        result.warnings.push("🚨 CRITICAL action: This action may be irreversible. Double-check all targets before approving.");
    }

    return result;
}

// ─── EC2 Dependency Checking ───
interface EC2DependencyCheck {
    isProduction: boolean;
    behindLoadBalancer: boolean;
    inAutoScalingGroup: boolean;
    hasElasticIp: boolean;
}

interface S3BucketContentCheck {
    hasObjects: boolean;
    hasVersions: boolean;
    hasDeleteMarkers: boolean;
}

async function checkEC2Dependencies(
    instanceId: string,
    region: string,
    userId: string,
    roleArn?: string,
    externalId?: string
): Promise<EC2DependencyCheck> {
    const clientConfig = await getClientConfig(userId, region || DEFAULT_REGION, roleArn, externalId);
    const ec2Client = new EC2Client(clientConfig);

    const result: EC2DependencyCheck = {
        isProduction: false,
        behindLoadBalancer: false,
        inAutoScalingGroup: false,
        hasElasticIp: false,
    };

    try {
        const describeResult = await ec2Client.send(
            new DescribeInstancesCommand({ InstanceIds: [instanceId] })
        );

        const instance = describeResult.Reservations?.[0]?.Instances?.[0];
        if (!instance) return result;

        // Check production tags
        const tags = instance.Tags || [];
        const envTag = tags.find(
            (t) => t.Key?.toLowerCase() === "environment" || t.Key?.toLowerCase() === "env"
        );
        if (envTag?.Value?.toLowerCase() === "production" || envTag?.Value?.toLowerCase() === "prod") {
            result.isProduction = true;
        }

        // Check Elastic IP
        if (instance.PublicIpAddress) {
            // An instance with a public IP from an Elastic IP association
            const networkInterfaces = instance.NetworkInterfaces || [];
            for (const ni of networkInterfaces) {
                if (ni.Association?.IpOwnerId !== "amazon") {
                    result.hasElasticIp = true;
                    break;
                }
            }
        }

        // Check ASG membership via tags
        const asgTag = tags.find((t) => t.Key === "aws:autoscaling:groupName");
        if (asgTag?.Value) {
            result.inAutoScalingGroup = true;
        }

        // Check ALB/NLB target group registration
        try {
            const elbClient = new ElasticLoadBalancingV2Client(clientConfig);
            const tgResult = await elbClient.send(new DescribeTargetGroupsCommand({}));
            for (const tg of tgResult.TargetGroups || []) {
                if (!tg.TargetGroupArn) continue;
                const healthResult = await elbClient.send(
                    new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn })
                );
                const isRegistered = healthResult.TargetHealthDescriptions?.some(
                    (th) => th.Target?.Id === instanceId
                );
                if (isRegistered) {
                    result.behindLoadBalancer = true;
                    break;
                }
            }
        } catch {
            // ELB access may not be available
        }
    } catch (err) {
        console.warn(`[Safety] Could not check dependencies for ${instanceId}:`, err);
    }

    return result;
}

async function checkS3BucketContents(
    bucketName: string,
    region: string,
    userId: string,
    roleArn?: string,
    externalId?: string
): Promise<S3BucketContentCheck> {
    const clientConfig = await getClientConfig(userId, region || DEFAULT_REGION, roleArn, externalId);
    const s3Client = new S3Client(clientConfig);

    const result: S3BucketContentCheck = {
        hasObjects: false,
        hasVersions: false,
        hasDeleteMarkers: false,
    };

    try {
        const objects = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));
        result.hasObjects = (objects.Contents?.length || 0) > 0;
    } catch {
        // Ignore here; caller handles unknown state through warnings.
    }

    try {
        const versions = await s3Client.send(new ListObjectVersionsCommand({ Bucket: bucketName, MaxKeys: 1 }));
        result.hasVersions = (versions.Versions?.length || 0) > 0;
        result.hasDeleteMarkers = (versions.DeleteMarkers?.length || 0) > 0;
    } catch {
        // Ignore here; caller handles unknown state through warnings.
    }

    return result;
}
