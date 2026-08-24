import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../../models/resize-migration.model";
import { getCredentials } from "../../../../../store/workspace-credentials";
import { matchAndEnrichTaskError } from "../../error-kb.service";
import { callAzureAPI, getAzureSourceServerDetails, getAzureTargetInstanceTypes } from "../planner";
import { runAzureSnapshotCreation } from "./snapshot";

export async function runAzurePreflightChecks(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;

    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "preflight" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Starting Azure preflight checks.", timestamp: new Date() }];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        await addLog("info", "Checking Azure credential connections...");
        const creds = await getCredentials(userId, "azure");
        if (!creds || !creds.tenantId || !creds.subscriptionId || !creds.clientId || !creds.clientSecret) {
            throw {
                code: "AZURE_NOT_CONNECTED",
                message: "Azure integration credentials not linked or incomplete.",
                fix: "Link your Azure account credentials on the Integrations tab."
            };
        }
        await addLog("info", "Azure credentials verified.");

        await addLog("info", `Describing source VM ${job.sourceServerId} in region ${job.region}...`);
        const sourceDetails = await getAzureSourceServerDetails(userId, job.region, job.sourceServerId);
        await addLog("info", `Source VM exists. State: ${sourceDetails.state}, size: ${sourceDetails.type}.`);
        if (sourceDetails.adminUsername) {
            await addLog("info", `Detected Azure VM admin username: ${sourceDetails.adminUsername}.`);
        }

        job.metadata = {
            ...job.metadata,
            sourceAccessProfile: {
                keyPairName: null,
                suggestedUsername: sourceDetails.adminUsername || null,
                imageId: sourceDetails.imageId || null,
                imageName: sourceDetails.osType || null,
                platformDetails: sourceDetails.osType || null,
                hasUserData: false
            }
        };
        job.markModified("metadata");
        await job.save();

        await addLog("info", "Checking target VM size offerings availability...");
        const targetSizes = await getAzureTargetInstanceTypes(userId, job.region, job.sourceServerId);
        const offered = targetSizes.some(t => t.instanceType === job.targetServerType);
        if (!offered) {
            throw {
                code: "AZURE_SKU_UNAVAILABLE",
                message: `Target VM size ${job.targetServerType} is not offered in region ${job.region} for this VM architecture.`,
                fix: "Select a different VM size option compatible with the region."
            };
        }

        // Classification
        const classification = sourceDetails.tags?.Database || sourceDetails.name.toLowerCase().includes("db") ? "Partially external server" : "Self-contained server";
        job.metadata = {
            ...job.metadata,
            classification: {
                classification,
                confidence: "Medium",
                signals: ["Azure tags / naming indicators"],
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
        await job.save();

        // Trigger next background task
        runAzureSnapshotCreation(jobId, userId).catch(err => {
            console.error("[Preflight Auto-Trigger Error]:", err);
        });
    } catch (err: any) {
        await matchAndEnrichTaskError("azure", "preflight", err, task);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Preflight checks failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
