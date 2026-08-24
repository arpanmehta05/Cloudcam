import {
    EC2Client,
    CreateImageCommand,
    DescribeImagesCommand
} from "@aws-sdk/client-ec2";
import { getCredentials } from "@/store/workspace-credentials";
import { getClientConfig } from "@/providers/aws/client-factory";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "@/modules/resize-migration/models/resize-migration.model";
import { matchAndEnrichTaskError } from "@/modules/resize-migration/services/error-kb.service";

export async function runAwsAmiCreation(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
        console.error(`[AmiCreation] Job ${jobId} not found.`);
        return;
    }

    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "create_source_image" });
    if (!task) {
        console.error(`[AmiCreation] Task 'create_source_image' for job ${jobId} not found.`);
        return;
    }

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [
        {
            level: "info",
            message: "Starting AWS AMI creation task.",
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

        const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
        const client = new EC2Client(cfg);

        const amiName = `rabbittwatch-clone-${sourceServerId}-${Date.now()}`;
        await addLog("info", `Initiating CreateImage request for instance: ${sourceServerId} with name: ${amiName}...`);
        
        const createRes = await client.send(new CreateImageCommand({
            InstanceId: sourceServerId,
            Name: amiName,
            Description: `Rabbittwatch resize migration clone of ${sourceServerId}`,
            NoReboot: true
        }));

        const imageId = createRes.ImageId;
        if (!imageId) {
            throw new Error("AWS did not return a valid ImageId for the created AMI.");
        }

        await addLog("info", `AMI creation initiated successfully. ImageId: ${imageId}.`);
        
        job.sourceImageId = imageId;
        job.logs.push({
            level: "info",
            message: `AMI creation initiated. ImageId: ${imageId}.`,
            timestamp: new Date()
        });
        await job.save();

        // Start polling the AMI state
        await addLog("info", "Polling AMI status until it becomes available...");
        let isAvailable = false;
        let attempts = 0;
        const maxAttempts = 120; // 30 minutes total (15s interval)
        
        while (attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            try {
                const imgRes = await client.send(new DescribeImagesCommand({ ImageIds: [imageId] }));
                const image = imgRes.Images?.[0];
                if (!image) {
                    throw new Error(`AMI ${imageId} not found in AWS console.`);
                }

                const state = image.State;
                await addLog("info", `AMI state: ${state}. Polling attempt ${attempts}/${maxAttempts}.`);

                if (state === "available") {
                    isAvailable = true;
                    break;
                } else if (state === "failed") {
                    throw new Error("AMI state transitioned to 'failed' on AWS.");
                }
            } catch (pollErr: any) {
                await addLog("warning", `Error during polling check: ${pollErr.message || pollErr}. Retrying...`);
            }
        }

        if (!isAvailable) {
            throw new Error("Timeout waiting for AMI to become available on AWS.");
        }

        await addLog("info", "AMI is now available and ready to use.");
        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "launching_target");

    } catch (err: any) {
        console.error(`[AMI Creation Task Failure] Job ${jobId}:`, err);
        await matchAndEnrichTaskError("aws", "create_source_image", err, task);

        await addLog("error", `AMI creation task failed: ${task.errorMessage}`);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "failed");
    }
}
