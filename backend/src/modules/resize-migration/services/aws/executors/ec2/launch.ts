import {
    EC2Client,
    DescribeInstancesCommand,
    DescribeInstanceStatusCommand,
    RunInstancesCommand
} from "@aws-sdk/client-ec2";
import { getAwsSourceServerDetails } from "../../discovery.service";
import { getCredentials } from "@/store/workspace-credentials";
import { getClientConfig } from "@/providers/aws/client-factory";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "@/modules/resize-migration/models/resize-migration.model";
import { matchAndEnrichTaskError } from "@/modules/resize-migration/services/error-kb.service";

export async function runAwsTargetLaunch(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
        console.error(`[TargetLaunch] Job ${jobId} not found.`);
        return;
    }

    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "launch_target" });
    if (!task) {
        console.error(`[TargetLaunch] Task 'launch_target' for job ${jobId} not found.`);
        return;
    }

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [
        {
            level: "info",
            message: "Starting AWS target launch task.",
            timestamp: new Date()
        }
    ];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        const region = job.region;
        const sourceServerId = job.sourceServerId;

        await addLog("info", "Checking AWS credential connection status...");
        const creds = await getCredentials(userId, "aws");
        if (!creds || !creds.roleArn || !creds.externalId) {
            throw new Error("AWS credentials not found or incomplete.");
        }

        if (!job.sourceImageId) {
            throw new Error("Source AMI (ImageId) is missing from the job details.");
        }

        await addLog("info", `Retrieving configuration of source instance ${sourceServerId} to preserve parameters...`);
        const sourceDetails = await getAwsSourceServerDetails(userId, region, sourceServerId);

        const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
        const client = new EC2Client(cfg);

        const tagsList = Object.entries(sourceDetails.tags || {}).map(([Key, Value]) => ({ Key, Value: String(Value) }));
        tagsList.push({ Key: "rabbittwatch-migration-job-id", Value: jobId });
        
        const targetName = job.targetServerName || `${sourceDetails.name || sourceServerId}-resized`;
        const nameTagIndex = tagsList.findIndex(t => t.Key === "Name");
        if (nameTagIndex !== -1) {
            tagsList[nameTagIndex].Value = targetName;
        } else {
            tagsList.push({ Key: "Name", Value: targetName });
        }

        const tagSpecifications = [
            {
                ResourceType: "instance" as any,
                Tags: tagsList
            },
            {
                ResourceType: "volume" as any,
                Tags: [
                    { Key: "rabbittwatch-migration-job-id", Value: jobId },
                    { Key: "Name", Value: `${targetName}-volume` }
                ]
            }
        ];

        await addLog("info", `Launching target EC2 instance of type ${job.targetServerType} in subnet ${sourceDetails.subnetId} from cloned AMI ${job.sourceImageId}...`);
        const launchRes = await client.send(new RunInstancesCommand({
            ImageId: job.sourceImageId,
            InstanceType: job.targetServerType as any,
            MinCount: 1,
            MaxCount: 1,
            SubnetId: sourceDetails.subnetId,
            SecurityGroupIds: sourceDetails.securityGroups?.map((sg: any) => sg.groupId).filter(Boolean),
            KeyName: sourceDetails.keyName || undefined,
            IamInstanceProfile: sourceDetails.iamInstanceProfile ? { Arn: sourceDetails.iamInstanceProfile } : undefined,
            TagSpecifications: tagSpecifications,
            UserData: sourceDetails.userData || undefined
        }));

        const targetInstance = launchRes.Instances?.[0];
        if (!targetInstance || !targetInstance.InstanceId) {
            throw new Error("Target instance launch failed. No instance details returned from AWS.");
        }

        const targetInstanceId = targetInstance.InstanceId;
        await addLog("info", `Target EC2 instance initiated successfully. InstanceId: ${targetInstanceId}.`);

        job.targetServerId = targetInstanceId;
        job.targetServerName = targetName;
        job.metadata = {
            ...(job.metadata || {}),
            targetAccessProfile: {
                keyPairName: sourceDetails.keyName || null,
                reusedSourceKeyPair: Boolean(sourceDetails.keyName),
                suggestedUsername: sourceDetails.suggestedSshUsername || null,
                launchedFromImageId: job.sourceImageId,
                launchedFromImageName: sourceDetails.imageName || null,
                platformDetails: sourceDetails.platformDetails || null,
                userDataCopied: Boolean(sourceDetails.userData),
                publicIp: null,
                privateIp: null,
                publicDnsName: null
            }
        };
        job.markModified("metadata");
        job.logs.push({
            level: "info",
            message: `Target EC2 instance launched. InstanceId: ${targetInstanceId}.`,
            timestamp: new Date()
        });
        await job.save();

        if (sourceDetails.keyName) {
            await addLog("info", `Target launch reuses source EC2 key pair '${sourceDetails.keyName}'. If you already have that PEM file, use the same PEM for SSH on the new target.`);
        } else {
            await addLog("warning", "Target launch could not reuse a source EC2 key pair because the source instance had no visible KeyName. CloudWatcher cannot generate or download a new private PEM from AWS.");
        }
        if (sourceDetails.suggestedSshUsername) {
            await addLog("info", `Expected SSH username on the cloned target: ${sourceDetails.suggestedSshUsername}.`);
        }
        if (sourceDetails.userData) {
            await addLog("info", "Copied the source instance user-data script onto the cloned target launch so bootstrap hooks can run again if the original server relied on them.");
        }

        // Poll target instance state until "running"
        await addLog("info", "Polling target instance state until it is running...");
        let isRunning = false;
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes total (10s interval)

        while (attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 10000));

            try {
                const descRes = await client.send(new DescribeInstancesCommand({ InstanceIds: [targetInstanceId] }));
                const inst = descRes.Reservations?.[0]?.Instances?.[0];
                if (!inst) {
                    throw new Error(`Target instance ${targetInstanceId} not found in AWS console.`);
                }

                const state = inst.State?.Name;
                await addLog("info", `Target instance state: ${state}. Polling attempt ${attempts}/${maxAttempts}.`);

                if (state === "running") {
                    isRunning = true;
                    break;
                } else if (state === "terminated" || state === "shutting-down") {
                    throw new Error(`Target instance transitioned to unexpected state: ${state}.`);
                }
            } catch (pollErr: any) {
                await addLog("warning", `Error checking instance state: ${pollErr.message || pollErr}. Retrying...`);
            }
        }

        if (!isRunning) {
            throw new Error("Timeout waiting for target instance to enter 'running' state.");
        }

        // Poll instance status checks until they pass ("ok")
        await addLog("info", "Waiting for target instance system and instance status checks to pass...");
        let checksPassed = false;
        attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 10000));

            try {
                const statusRes = await client.send(new DescribeInstanceStatusCommand({
                    InstanceIds: [targetInstanceId],
                    IncludeAllInstances: true
                }));
                const status = statusRes.InstanceStatuses?.[0];

                if (status) {
                    const sysStatus = status.SystemStatus?.Status;
                    const instStatus = status.InstanceStatus?.Status;
                    
                    await addLog("info", `Status check status - System: ${sysStatus}, Instance: ${instStatus}. Attempt ${attempts}/${maxAttempts}.`);

                    if (sysStatus === "ok" && instStatus === "ok") {
                        checksPassed = true;
                        break;
                    }
                } else {
                    await addLog("info", `Status checks not yet initialized. Attempt ${attempts}/${maxAttempts}.`);
                }
            } catch (statusErr: any) {
                await addLog("warning", `Error checking status checks: ${statusErr.message || statusErr}. Retrying...`);
            }
        }

        if (!checksPassed) {
            await addLog("warning", "Status checks did not pass within the timeout period. Continuing with validation step.");
        } else {
            await addLog("info", "All AWS EC2 instance status checks passed successfully.");
        }

        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "validating");

    } catch (err: any) {
        console.error(`[Target Launch Task Failure] Job ${jobId}:`, err);
        await matchAndEnrichTaskError("aws", "launch_target", err, task);

        await addLog("error", `Target launch task failed: ${task.errorMessage}`);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "failed");
    }
}
