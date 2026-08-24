import { getAwsSourceServerDetails, getAwsTargetInstanceTypes } from "./discovery.service";
import { getCredentials } from "../../../../store/workspace-credentials";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../models/resize-migration.model";
import { matchAndEnrichTaskError } from "../error-kb.service";
import {
    determineAccessMode,
    verifyAwsIamPermissions,
    classifyAwsServerWorkload
} from "./planner/analysis";

export { determineAccessMode, classifyAwsServerWorkload };

export async function runAwsPreflightChecks(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
        console.error(`[Preflight] Job ${jobId} not found.`);
        return;
    }

    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "preflight" });
    if (!task) {
        console.error(`[Preflight] Preflight task for job ${jobId} not found.`);
        return;
    }

    // Initialize task to running
    task.status = "running";
    task.startedAt = new Date();
    task.logs = [
        {
            level: "info",
            message: "Starting AWS preflight verification tasks.",
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
        const targetServerType = job.targetServerType;

        // Access Mode Detection & Trust Boundary Messaging
        const { mode: resolvedAccessMode, warnings: accessWarnings } = determineAccessMode(job);
        
        for (const warning of accessWarnings) {
            await addLog("warning", warning);
        }

        if (resolvedAccessMode !== job.accessMode) {
            job.accessMode = resolvedAccessMode;
            await ResizeMigrationJobModel.updateOne(
                { _id: jobId, userId },
                { $set: { accessMode: resolvedAccessMode } }
            );
        }

        if (resolvedAccessMode === "cloud_only") {
            await addLog("warning", "Internal server access is not configured. Rabbittwatch will perform a cloud-level migration using provider snapshots and cloud configuration. Application validation must be confirmed manually after the target server starts.");
            await addLog("info", "Without internal access, Rabbittwatch can clone the server image and copy cloud configuration, but cannot verify app internals.");
        } else {
            await addLog("info", `Deep inspection mode active via ${job.accessConfig?.method}. Rabbittwatch will have access to inspect internal server components.`);
            await addLog("info", "With internal access, Rabbittwatch can inspect services, containers, ports, and local dependencies for deeper validation.");
        }

        // 1. Credentials Check
        await addLog("info", "Checking AWS credential connection status...");
        const creds = await getCredentials(userId, "aws");
        if (!creds || !creds.roleArn || !creds.externalId) {
            throw {
                code: "AWS_NOT_CONNECTED",
                message: "AWS integration is not connected for this user.",
                fix: "Navigate to the AWS Integrations page and link your AWS account."
            };
        }
        await addLog("info", "AWS integration credentials verified.");

        // 2. Source Server Check
        await addLog("info", `Describing source EC2 instance ${sourceServerId} in region ${region}...`);
        let sourceDetails: any;
        try {
            sourceDetails = await getAwsSourceServerDetails(userId, region, sourceServerId);
        } catch (err: any) {
            throw {
                code: "SOURCE_INSTANCE_NOT_FOUND",
                message: `Source EC2 instance ${sourceServerId} could not be found or described in region ${region}.`,
                fix: "Confirm that the instance exists in the AWS Console under this region and is not terminated."
            };
        }
        await addLog("info", `Source instance verified. Type: ${sourceDetails.type}, State: ${sourceDetails.state}, Architecture: ${sourceDetails.architecture}.`);
        if (sourceDetails.platformDetails || sourceDetails.imageName) {
            await addLog(
                "info",
                `Source machine profile detected from AWS image metadata: ${sourceDetails.platformDetails || sourceDetails.imageName}.`
            );
        }
        if (sourceDetails.keyName) {
            await addLog(
                "info",
                `Source instance uses EC2 key pair '${sourceDetails.keyName}'. CloudWatcher will try to reuse this same key pair on the cloned target so the existing PEM can keep working.`
            );
        } else {
            await addLog(
                "warning",
                "Source instance does not expose an EC2 key pair name. CloudWatcher cannot auto-reuse a PEM key for the target unless AWS reports one on the source."
            );
        }
        if (sourceDetails.suggestedSshUsername) {
            await addLog("info", `Suggested SSH username for this machine family: ${sourceDetails.suggestedSshUsername}.`);
        }

        const metadata = {
            ...(job.metadata || {}),
            sourceAccessProfile: {
                keyPairName: sourceDetails.keyName || null,
                suggestedUsername: sourceDetails.suggestedSshUsername || null,
                imageId: sourceDetails.imageId || null,
                imageName: sourceDetails.imageName || null,
                platformDetails: sourceDetails.platformDetails || null,
                hasUserData: Boolean(sourceDetails.userData)
            }
        };
        await ResizeMigrationJobModel.updateOne(
            { _id: jobId, userId },
            { $set: { metadata } }
        );

        // 3. Target Size Check
        await addLog("info", `Checking target instance type ${targetServerType} availability in region ${region}...`);
        const targetSizes = await getAwsTargetInstanceTypes(userId, region, sourceServerId);
        const sizeAvailable = targetSizes.some(t => t.instanceType === targetServerType);
        if (!sizeAvailable) {
            throw {
                code: "TARGET_SIZE_UNAVAILABLE",
                message: `Target instance type ${targetServerType} is not available in region ${region} for architecture ${sourceDetails.architecture}.`,
                fix: `Select an alternative instance size that matches the ${sourceDetails.architecture} architecture and is offered in ${region}.`
            };
        }
        await addLog("info", `Target instance type ${targetServerType} is available.`);

        // 3.5 Workload Classification
        await addLog("info", "Performing server workload classification based on cloud-only signals...");
        try {
            const classificationResult = await classifyAwsServerWorkload(
                userId,
                region,
                sourceServerId,
                sourceDetails.vpcId,
                sourceDetails.tags
            );

            // Initialize metadata on the job if not present
            const updatedMetadata = job.metadata || {};
            updatedMetadata.classification = {
                classification: classificationResult.classification,
                confidence: classificationResult.confidence,
                signals: classificationResult.signals,
                detectedAt: new Date()
            };

            await ResizeMigrationJobModel.updateOne(
                { _id: jobId, userId },
                {
                    $set: { metadata: updatedMetadata }
                }
            );

            await addLog("info", `Server classified as: ${classificationResult.classification} (Confidence: ${classificationResult.confidence}). Signals: ${classificationResult.signals.join(", ")}`);
        } catch (classErr: any) {
            await addLog("warning", `Server workload classification failed: ${classErr.message || classErr}. Falling back to default.`);
        }

        // 4. IAM Permissions Dry-Run Checks
        await verifyAwsIamPermissions(
            userId,
            region,
            creds,
            sourceServerId,
            targetServerType,
            job.cutoverMode || "manual",
            sourceDetails,
            addLog
        );

        // 5. Downtime & drift warning
        if (sourceDetails.state === "running") {
            await addLog("warning", "Source server is currently running. Snapshotting will perform a live disk clone. To avoid potential database or application data drift, we recommend scheduling migration during low-traffic periods, or stopping database/application services before starting the image creation task.");
        }

        // Success completion
        await addLog("info", "All preflight checks completed successfully.");
        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        // Update Job Status directly if it hasn't advanced past preflight/draft
        const currentJob = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
        const shouldSetStatus = currentJob && (currentJob.status === "preflight" || currentJob.status === "draft");

        await ResizeMigrationJobModel.updateOne(
            { _id: jobId, userId },
            {
                ...(shouldSetStatus ? { $set: { status: "preflight" } } : {}),
                $push: {
                    logs: {
                        level: "info",
                        message: "Preflight checks succeeded.",
                        timestamp: new Date()
                    }
                }
            }
        );

    } catch (err: any) {
        console.error(`[Preflight Checks Failure] Job ${jobId}:`, err);
        await matchAndEnrichTaskError("aws", "preflight", err, task);

        await addLog("error", `Preflight check failed: ${task.errorMessage}`);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        // Update Job Status to failed only if it hasn't advanced past preflight/draft
        const currentJob = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
        const shouldSetStatus = currentJob && (currentJob.status === "preflight" || currentJob.status === "draft");

        await ResizeMigrationJobModel.updateOne(
            { _id: jobId, userId },
            {
                ...(shouldSetStatus ? { $set: { status: "failed" } } : {}),
                $push: {
                    logs: {
                        level: "error",
                        message: `Preflight checks failed: ${task.errorMessage}`,
                        timestamp: new Date()
                    }
                }
            }
        );
    }
}