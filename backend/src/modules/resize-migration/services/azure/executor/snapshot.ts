import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../../models/resize-migration.model";
import { getCredentials } from "../../../../../store/workspace-credentials";
import { matchAndEnrichTaskError } from "../../error-kb.service";
import { callAzureAPI, getAzureSourceServerDetails } from "../planner";
import { runAzureTargetLaunch } from "./launch";

export async function runAzureSnapshotCreation(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;

    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "create_source_image" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Starting Azure OS Disk snapshot copy.", timestamp: new Date() }];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        const creds = (await getCredentials(userId, "azure"))!;
        const sourceDetails = await getAzureSourceServerDetails(userId, job.region, job.sourceServerId);
        const osDiskId = sourceDetails.blockDeviceMappings[0]?.volumeId;

        if (!osDiskId) {
            throw {
                code: "AZURE_DISK_NOT_FOUND",
                message: "Managed OS Disk ID could not be identified on the source VM.",
                fix: "Confirm that the source VM has a valid OS disk attached."
            };
        }

        const snapshotName = `snapshot-${jobId.slice(-6)}-${Date.now()}`;
        const rg = sourceDetails.resourceGroup;
        const snapshotPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Compute/snapshots/${snapshotName}`;

        await addLog("info", `Creating Azure disk snapshot ${snapshotName} from ${osDiskId}...`);
        await callAzureAPI(creds, "PUT", snapshotPath, {
            location: job.region,
            properties: {
                creationData: {
                    createOption: "Copy",
                    sourceResourceId: osDiskId
                }
            }
        }, "2023-04-02");

        // Poll for completion
        let isDone = false;
        let attempts = 0;
        while (!isDone && attempts < 60) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000));
            const snap = await callAzureAPI(creds, "GET", snapshotPath, null, "2023-04-02");
            const state = snap.properties?.provisioningState;
            await addLog("info", `Polling snapshot creation state: ${state}...`);
            if (state === "Succeeded") {
                isDone = true;
            } else if (state === "Failed") {
                throw new Error("Azure snapshot creation failed provisioning.");
            }
        }

        if (!isDone) {
            throw new Error("Timeout waiting for Azure disk snapshot creation.");
        }

        job.sourceSnapshotId = snapshotPath;
        await job.save();

        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        job.status = "launching_target";
        await job.save();

        // Trigger next background task
        runAzureTargetLaunch(jobId, userId).catch(err => {
            console.error("[Snapshot Auto-Trigger Error]:", err);
        });
    } catch (err: any) {
        await matchAndEnrichTaskError("azure", "snapshotting", err, task);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Snapshot task failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
