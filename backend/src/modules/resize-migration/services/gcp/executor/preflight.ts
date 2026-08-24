import {
    ResizeMigrationJobModel,
    ResizeMigrationTaskModel
} from "../../../models/resize-migration.model";
import { getGcpClient, getGcpSourceServerDetails, getGcpTargetInstanceTypes } from "../planner";
import { runGcpSnapshotCreation } from "./snapshot";
import { matchAndEnrichTaskError } from "../../error-kb.service";

export async function runGcpPreflightChecks(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;
    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "preflight" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Starting GCP preflight checks...", timestamp: new Date() }];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        await addLog("info", "Checking GCP credential connections...");
        const { projectId } = await getGcpClient(userId);
        await addLog("info", `GCP credentials verified for project ${projectId}.`);

        await addLog("info", `Describing source VM ${job.sourceServerId} in region ${job.region}...`);
        const sourceDetails = await getGcpSourceServerDetails(userId, job.region, job.sourceServerId);
        await addLog("info", `Source VM exists. State: ${sourceDetails.state}, type: ${sourceDetails.type}.`);

        job.metadata = {
            ...job.metadata,
            sourceAccessProfile: {
                keyPairName: null,
                suggestedUsername: sourceDetails.suggestedSshUsername || "ubuntu",
                imageId: sourceDetails.imageId || null,
                imageName: sourceDetails.imageId || null,
                platformDetails: "Ubuntu Server",
                hasUserData: false
            }
        };
        job.markModified("metadata");
        await job.save();

        await addLog("info", "Checking target VM size offerings availability...");
        const targetSizes = await getGcpTargetInstanceTypes(userId, job.region, job.sourceServerId);
        const offered = targetSizes.some(t => t.instanceType === job.targetServerType);
        if (!offered) {
            throw {
                code: "GCP_SKU_UNAVAILABLE",
                message: `Target VM machine type ${job.targetServerType} is not offered or available in your workspace configuration.`,
                fix: "Select a different machine type size option compatible with GCP."
            };
        }

        // Classification
        const classification = sourceDetails.tags?.database || sourceDetails.name.toLowerCase().includes("db") ? "Partially external server" : "Self-contained server";
        job.metadata = {
            ...job.metadata,
            classification: {
                classification,
                confidence: "Medium",
                signals: ["GCP tags / naming indicators"],
                detectedAt: new Date(),
            }
        };
        job.markModified("metadata");
        await job.save();
        await addLog("info", `Server workload classified as: ${classification}.`);

        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        job.status = "snapshotting";
        job.logs.push({ level: "info", message: "Preflight checks succeeded.", timestamp: new Date() });
        await job.save();

        // Trigger next background task
        runGcpSnapshotCreation(jobId, userId).catch(err => {
            console.error("[Preflight Auto-Trigger Error]:", err);
        });
    } catch (err: any) {
        await matchAndEnrichTaskError("gcp", "preflight", err, task);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Preflight checks failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
