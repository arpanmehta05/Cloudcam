import {
    EC2Client,
    DescribeInstancesCommand,
    DescribeAddressesCommand,
    DescribeVolumesCommand,
    DescribeInstanceTypeOfferingsCommand,
    CreateImageCommand,
    RunInstancesCommand,
    CreateTagsCommand,
    AssociateAddressCommand,
    DescribeSecurityGroupsCommand,
    DescribeImagesCommand,
    DescribeInstanceStatusCommand,
    StopInstancesCommand,
    StartInstancesCommand,
    DescribeInstanceAttributeCommand
} from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import {
    ElasticLoadBalancingV2Client,
    DescribeTargetGroupsCommand,
    DescribeTargetHealthCommand
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { getCredentials } from "../../../../store/workspace-credentials";
import { getResources } from "../../../../services/aws/resources.service";
import { getClientConfig } from "../../../../providers/aws/client-factory";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../models/resize-migration.model";
import { ResizeMigrationAccessMode } from "../../../../types/resize-migration.types";
import { matchAndEnrichTaskError } from "../error-kb.service";

export async function runAwsTargetRollback(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
        console.error(`[TargetRollback] Job ${jobId} not found.`);
        return;
    }

    const addJobLog = async (level: "info" | "warning" | "error", message: string) => {
        job.logs.push({ level, message, timestamp: new Date() });
        await job.save();
    };

    try {
        const region = job.region;
        const sourceServerId = job.sourceServerId;
        const targetServerId = job.targetServerId;

        await addJobLog("info", "Starting AWS rollback execution...");

        // Track fallback success for the failed task if present
        try {
            const failedTask = await ResizeMigrationTaskModel.findOne({ jobId, userId, status: "failed" });
            if (failedTask && failedTask.errorCode) {
                const stepKey = failedTask.key === "validate_target" ? "validating" : 
                                failedTask.key === "launch_target" ? "launching_target" : 
                                failedTask.key === "create_source_image" ? "create_source_image" : "any";
                const { recordSuccessfulFallback } = await import("../error-kb.service");
                await recordSuccessfulFallback("aws", stepKey, failedTask.errorCode);
            }
        } catch (trackErr) {
            console.error("[TargetRollback] Failed to track fallback success:", trackErr);
        }

        const creds = await getCredentials(userId, "aws");
        if (!creds || !creds.roleArn || !creds.externalId) {
            throw new Error("AWS credentials not found or incomplete.");
        }

        const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
        const client = new EC2Client(cfg);

        // 1. Move Elastic IP back if it was associated with target
        if (job.cutoverMode === "elastic_ip" && targetServerId) {
            await addJobLog("info", `Searching for Elastic IP associated with target instance ${targetServerId} to return to source...`);
            const addrRes = await client.send(new DescribeAddressesCommand({
                Filters: [{ Name: "instance-id", Values: [targetServerId] }]
            }));
            const address = addrRes.Addresses?.[0];

            if (address && address.AllocationId && address.PublicIp) {
                await addJobLog("info", `Found Elastic IP ${address.PublicIp}. Reassociating back to source instance ${sourceServerId}...`);
                await client.send(new AssociateAddressCommand({
                    AllocationId: address.AllocationId,
                    InstanceId: sourceServerId,
                    AllowReassociation: true
                }));
                await addJobLog("info", `Successfully reassociated Elastic IP ${address.PublicIp} back to source instance ${sourceServerId}.`);
            } else {
                await addJobLog("info", "No Elastic IP found associated with the target server.");
            }
        }

        // 2. Ensure source server is running
        await addJobLog("info", `Checking state of source instance ${sourceServerId}...`);
        const sourceDesc = await client.send(new DescribeInstancesCommand({ InstanceIds: [sourceServerId] }));
        const sourceInstance = sourceDesc.Reservations?.[0]?.Instances?.[0];
        const sourceState = sourceInstance?.State?.Name;

        if (sourceState && sourceState !== "running") {
            await addJobLog("info", `Source server state is '${sourceState}'. Starting source instance ${sourceServerId}...`);
            await client.send(new StartInstancesCommand({ InstanceIds: [sourceServerId] }));
            await addJobLog("info", `Start command sent successfully to source instance ${sourceServerId}.`);
        } else {
            await addJobLog("info", `Source instance ${sourceServerId} is already running.`);
        }

        // 3. Keep target server available for inspection
        if (targetServerId) {
            await addJobLog("info", `Target server ${targetServerId} remains active for user inspection and debugging.`);
        }

        // 4. Update task states to skipped
        const pendingTasks = await ResizeMigrationTaskModel.find({ jobId, userId, status: { $ne: "succeeded" } });
        for (const task of pendingTasks) {
            task.status = "skipped";
            task.logs.push({ level: "info", message: "Task skipped due to migration rollback.", timestamp: new Date() });
            await task.save();
        }

        await addJobLog("info", "Migration rollback completed successfully.");
    } catch (err: any) {
        console.error(`[Rollback Failure] Job ${jobId}:`, err);
        await addJobLog("error", `Rollback failed: ${err.message || err}`);
    }
}
