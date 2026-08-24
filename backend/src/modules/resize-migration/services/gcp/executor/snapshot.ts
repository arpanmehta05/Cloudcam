import {
    ResizeMigrationJobModel,
    ResizeMigrationTaskModel
} from "../../../models/resize-migration.model";
import { getGcpClient, getGcpSourceServerDetails } from "../planner";
import { runGcpTargetLaunch } from "./launch";
import { matchAndEnrichTaskError } from "../../error-kb.service";

export async function runGcpSnapshotCreation(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;
    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "create_source_image" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Initiating persistent disk snapshot in GCP...", timestamp: new Date() }];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        const { client, projectId } = await getGcpClient(userId);
        const sourceDetails = await getGcpSourceServerDetails(userId, job.region, job.sourceServerId);

        // Find the boot disk volumeId
        const bootDisk = sourceDetails.blockDeviceMappings.find((m: any) => m.boot);
        const diskName = bootDisk?.volumeId;
        const zoneName = sourceDetails.zone;

        if (!diskName || !zoneName) {
            throw {
                code: "GCP_BOOT_DISK_NOT_FOUND",
                message: "Boot disk or zone could not be identified on the source VM.",
                fix: "Confirm that the source VM has a boot disk attached."
            };
        }

        const snapshotName = `snapshot-${jobId.slice(-6)}-${Date.now()}`;
        await addLog("info", `Creating persistent disk snapshot ${snapshotName} from disk ${diskName} in zone ${zoneName}...`);

        const op = await client.compute.disks.createSnapshot({
            project: projectId,
            zone: zoneName,
            disk: diskName,
            requestBody: {
                name: snapshotName
            }
        });

        await addLog("info", `Snapshot operation initiated: ${op.data.name}. Polling for completion...`);

        // Poll snapshot status until READY
        let isDone = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        const snapshotPath = `projects/${projectId}/global/snapshots/${snapshotName}`;

        while (!isDone && attempts < maxAttempts) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000));
            const snapRes = await client.compute.snapshots.get({
                project: projectId,
                snapshot: snapshotName
            });
            const status = snapRes.data.status;
            await addLog("info", `Polling snapshot creation state: ${status}...`);

            if (status === "READY") {
                isDone = true;
            } else if (status === "FAILED") {
                throw new Error("GCP snapshot creation failed on Compute Engine.");
            }
        }

        if (!isDone) {
            throw new Error("Timeout waiting for GCP snapshot creation.");
        }

        job.sourceSnapshotId = snapshotPath;
        await job.save();

        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        job.status = "launching_target";
        job.logs.push({ level: "info", message: "Source disk snapshot completed.", timestamp: new Date() });
        await job.save();

        runGcpTargetLaunch(jobId, userId).catch(err => {
            console.error("[Snapshot Auto-Trigger Error]:", err);
        });
    } catch (err: any) {
        await matchAndEnrichTaskError("gcp", "snapshotting", err, task);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Snapshot creation failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
