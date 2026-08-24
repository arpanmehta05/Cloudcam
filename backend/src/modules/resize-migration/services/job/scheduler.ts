import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../models/resize-migration.model";
import { runAzurePreflightChecks } from "../azure/azure-resize-migration.service";
import { runGcpPreflightChecks } from "../gcp/gcp-resize-migration.service";
import { runAwsPreflightChecks } from "../aws";

export async function checkAndRunScheduledJobs(): Promise<void> {
    const now = new Date();
    try {
        const jobs = await ResizeMigrationJobModel.find({
            status: "preflight",
            "metadata.scheduledExecutionTime": { $lte: now.toISOString() }
        });

        for (const job of jobs) {
            const task = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "preflight" });
            if (task && task.status === "pending") {
                console.log(`[Scheduled Jobs] Triggering scheduled job ${job._id} (scheduled for ${job.metadata?.scheduledExecutionTime})`);
                
                job.logs.push({
                    level: "info",
                    message: `Scheduled execution time reached. Triggering background preflight checks.`,
                    timestamp: new Date()
                });
                await job.save();

                if (job.provider === "azure") {
                    runAzurePreflightChecks(job._id.toString(), job.userId).catch((err) => {
                        console.error(`[Preflight Background Error] Job ${job._id}:`, err);
                    });
                } else if (job.provider === "gcp") {
                    runGcpPreflightChecks(job._id.toString(), job.userId).catch((err) => {
                        console.error(`[Preflight Background Error] Job ${job._id}:`, err);
                    });
                } else {
                    runAwsPreflightChecks(job._id.toString(), job.userId).catch((err) => {
                        console.error(`[Preflight Background Error] Job ${job._id}:`, err);
                    });
                }
            }
        }
    } catch (err) {
        console.error("[Scheduled Jobs Picker] Error querying database:", err);
    }
}
