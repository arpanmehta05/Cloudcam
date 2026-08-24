import { ResizeMigrationJobStatus } from "../../../../types/resize-migration.types";
import { runAwsPreflightChecks, runAwsAmiCreation, runAwsTargetLaunch, runAwsTargetValidation, runAwsTargetCutover, runAwsTargetRollback } from "../aws";
import { runAzurePreflightChecks, runAzureSnapshotCreation, runAzureTargetLaunch, runAzureTargetValidation, runAzureTargetCutover, runAzureTargetRollback } from "../azure/azure-resize-migration.service";
import { runGcpPreflightChecks, runGcpSnapshotCreation, runGcpTargetLaunch, runGcpTargetValidation, runGcpTargetCutover, runGcpTargetRollback } from "../gcp/gcp-resize-migration.service";

export function triggerBackgroundSteps(
    job: any,
    jobId: string,
    userId: string,
    nextStatus: ResizeMigrationJobStatus
): void {
    if (job.provider === "azure") {
        if (nextStatus === "preflight") {
            const scheduledTime = job.metadata?.scheduledExecutionTime;
            const isScheduledInFuture = scheduledTime && new Date(scheduledTime).getTime() > Date.now();
            if (isScheduledInFuture) {
                job.logs.push({
                    level: "info",
                    message: `Job execution scheduled for ${new Date(scheduledTime).toLocaleString()}. Waiting to trigger.`,
                    timestamp: new Date()
                });
                job.save().catch((e: any) => console.error("Error saving scheduled log", e));
            } else {
                runAzurePreflightChecks(jobId, userId).catch((err) => {
                    console.error(`[Preflight Background Error] Job ${jobId}:`, err);
                });
            }
        } else if (nextStatus === "snapshotting") {
            runAzureSnapshotCreation(jobId, userId).catch((err) => {
                console.error(`[Snapshot Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "launching_target") {
            runAzureTargetLaunch(jobId, userId).catch((err) => {
                console.error(`[TargetLaunch Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "validating") {
            runAzureTargetValidation(jobId, userId).catch((err) => {
                console.error(`[TargetValidation Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "cutover") {
            runAzureTargetCutover(jobId, userId).catch((err) => {
                console.error(`[TargetCutover Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "rolled_back") {
            runAzureTargetRollback(jobId, userId).catch((err) => {
                console.error(`[TargetRollback Background Error] Job ${jobId}:`, err);
            });
        }
    } else if (job.provider === "gcp") {
        if (nextStatus === "preflight") {
            const scheduledTime = job.metadata?.scheduledExecutionTime;
            const isScheduledInFuture = scheduledTime && new Date(scheduledTime).getTime() > Date.now();
            if (isScheduledInFuture) {
                job.logs.push({
                    level: "info",
                    message: `Job execution scheduled for ${new Date(scheduledTime).toLocaleString()}. Waiting to trigger.`,
                    timestamp: new Date()
                });
                job.save().catch((e: any) => console.error("Error saving scheduled log", e));
            } else {
                runGcpPreflightChecks(jobId, userId).catch((err) => {
                    console.error(`[Preflight Background Error] Job ${jobId}:`, err);
                });
            }
        } else if (nextStatus === "snapshotting") {
            runGcpSnapshotCreation(jobId, userId).catch((err) => {
                console.error(`[Snapshot Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "launching_target") {
            runGcpTargetLaunch(jobId, userId).catch((err) => {
                console.error(`[TargetLaunch Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "validating") {
            runGcpTargetValidation(jobId, userId).catch((err) => {
                console.error(`[TargetValidation Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "cutover") {
            runGcpTargetCutover(jobId, userId).catch((err) => {
                console.error(`[TargetCutover Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "rolled_back") {
            runGcpTargetRollback(jobId, userId).catch((err) => {
                console.error(`[TargetRollback Background Error] Job ${jobId}:`, err);
            });
        }
    } else {
        if (nextStatus === "preflight") {
            const scheduledTime = job.metadata?.scheduledExecutionTime;
            const isScheduledInFuture = scheduledTime && new Date(scheduledTime).getTime() > Date.now();
            if (isScheduledInFuture) {
                job.logs.push({
                    level: "info",
                    message: `Job execution scheduled for ${new Date(scheduledTime).toLocaleString()}. Waiting to trigger.`,
                    timestamp: new Date()
                });
                job.save().catch((e: any) => console.error("Error saving scheduled log", e));
            } else {
                runAwsPreflightChecks(jobId, userId).catch((err) => {
                    console.error(`[Preflight Background Error] Job ${jobId}:`, err);
                });
            }
        } else if (nextStatus === "snapshotting") {
            runAwsAmiCreation(jobId, userId).catch((err) => {
                console.error(`[AmiCreation Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "launching_target") {
            runAwsTargetLaunch(jobId, userId).catch((err) => {
                console.error(`[TargetLaunch Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "validating") {
            runAwsTargetValidation(jobId, userId).catch((err) => {
                console.error(`[TargetValidation Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "cutover") {
            runAwsTargetCutover(jobId, userId).catch((err) => {
                console.error(`[TargetCutover Background Error] Job ${jobId}:`, err);
            });
        } else if (nextStatus === "rolled_back") {
            runAwsTargetRollback(jobId, userId).catch((err) => {
                console.error(`[TargetRollback Background Error] Job ${jobId}:`, err);
            });
        }
    }
}
