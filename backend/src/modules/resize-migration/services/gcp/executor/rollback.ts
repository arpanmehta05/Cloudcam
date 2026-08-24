import {
    ResizeMigrationJobModel,
    ResizeMigrationTaskModel
} from "../../../models/resize-migration.model";
import { getGcpClient } from "../planner";
import { recordSuccessfulFallback } from "../../error-kb.service";

export async function runGcpTargetRollback(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;
    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "preserve_source" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Rollback requested. Restoring previous state...", timestamp: new Date() }];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        const { client, projectId } = await getGcpClient(userId);

        const rollbackState = job.rollbackState || {};
        const { targetInstanceName, diskName, snapshotName, zone } = rollbackState;

        // Skip uncompleted timeline tasks
        const tasks = await ResizeMigrationTaskModel.find({ jobId, userId });
        for (const t of tasks) {
            if (t.status !== "succeeded" && t.key !== "preserve_source") {
                t.status = "skipped";
                await t.save();
            }
        }

        // 1. Delete target VM instance
        if (targetInstanceName && zone) {
            try {
                await addLog("info", `Deleting target VM instance ${targetInstanceName} in zone ${zone}...`);
                const op = await client.compute.instances.delete({
                    project: projectId,
                    zone,
                    instance: targetInstanceName
                });
                await addLog("info", `VM deletion operation initiated: ${op.data.name}. Polling for completion...`);

                // Poll VM deletion
                let isVmDeleted = false;
                let vmAttempts = 0;
                while (!isVmDeleted && vmAttempts < 30) {
                    vmAttempts++;
                    await new Promise(r => setTimeout(r, 5000));
                    try {
                        const check = await client.compute.instances.get({
                            project: projectId,
                            zone,
                            instance: targetInstanceName
                        });
                        const status = check.data.status;
                        await addLog("info", `Polling target VM deletion status: ${status}...`);
                    } catch (checkErr: any) {
                        // 404 means deleted
                        if (checkErr.status === 404 || checkErr.code === 404 || String(checkErr).includes("notFound")) {
                            isVmDeleted = true;
                            await addLog("info", "Target VM deleted successfully.");
                        } else {
                            throw checkErr;
                        }
                    }
                }
            } catch (vmErr: any) {
                if (vmErr.status === 404 || vmErr.code === 404 || String(vmErr).includes("notFound")) {
                    await addLog("info", "Target VM already deleted.");
                } else {
                    await addLog("warning", `Failed to delete target VM instance: ${vmErr.message || vmErr}`);
                }
            }
        }

        // 2. Delete cloned boot disk (should be auto-deleted, but we double-check)
        if (diskName && zone) {
            try {
                await addLog("info", `Deleting cloned target boot disk ${diskName} in zone ${zone}...`);
                const op = await client.compute.disks.delete({
                    project: projectId,
                    zone,
                    disk: diskName
                });
                await addLog("info", `Disk deletion operation initiated: ${op.data.name}.`);
            } catch (diskErr: any) {
                if (diskErr.status === 404 || diskErr.code === 404 || String(diskErr).includes("notFound")) {
                    await addLog("info", "Cloned target boot disk already deleted.");
                } else {
                    await addLog("warning", `Disk deletion skipped/failed: ${diskErr.message || diskErr}`);
                }
            }
        }

        // 3. Delete snapshot
        if (snapshotName) {
            try {
                await addLog("info", `Deleting source snapshot ${snapshotName}...`);
                const op = await client.compute.snapshots.delete({
                    project: projectId,
                    snapshot: snapshotName
                });
                await addLog("info", `Snapshot deletion operation initiated: ${op.data.name}.`);
            } catch (snapErr: any) {
                if (snapErr.status === 404 || snapErr.code === 404 || String(snapErr).includes("notFound")) {
                    await addLog("info", "Snapshot already deleted.");
                } else {
                    await addLog("warning", `Snapshot deletion failed: ${snapErr.message || snapErr}`);
                }
            }
        }

        // Record successful fallback if a step was failed
        try {
            const failedTask = await ResizeMigrationTaskModel.findOne({ jobId, userId, status: "failed" });
            if (failedTask && failedTask.errorCode) {
                const stepKey = failedTask.key === "validate_target" ? "validating" : 
                                failedTask.key === "launch_target" ? "launching_target" : 
                                failedTask.key === "create_source_image" ? "create_source_image" : "any";
                await recordSuccessfulFallback("gcp", stepKey, failedTask.errorCode);
            }
        } catch (trackErr) {
            console.error("[GCP Rollback] Failed to track fallback success:", trackErr);
        }

        task.logs.push({ level: "info", message: "Rollback completed. Source server remains active.", timestamp: new Date() });
        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        job.status = "rolled_back";
        job.logs.push({ level: "info", message: "Job rolled back successfully.", timestamp: new Date() });
        await job.save();
    } catch (err: any) {
        console.error(`[GCP Rollback Error] Job ${jobId}:`, err);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Rollback failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
