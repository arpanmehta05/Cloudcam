import {
    IResizeMigrationJob,
    IResizeMigrationTask,
    ResizeMigrationJobModel,
    ResizeMigrationTaskModel,
} from "../../models/resize-migration.model";
import { ResizeMigrationJobStatus } from "../../../../types/resize-migration.types";
import { runAzurePreflightChecks, runAzureSnapshotCreation, runAzureTargetLaunch, runAzureTargetValidation, runAzureTargetCutover } from "../azure/azure-resize-migration.service";
import { runGcpPreflightChecks, runGcpSnapshotCreation, runGcpTargetLaunch, runGcpTargetValidation, runGcpTargetCutover } from "../gcp/gcp-resize-migration.service";
import { runAwsPreflightChecks, runAwsAmiCreation, runAwsTargetLaunch, runAwsTargetValidation, runAwsTargetCutover } from "../aws";

export async function resumeResizeMigrationJob(userId: string, jobId: string): Promise<{
    job: IResizeMigrationJob;
    tasks: IResizeMigrationTask[];
}> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
        throw new Error("Resize migration job not found");
    }

    if (job.status !== "failed") {
        throw new Error("Only failed jobs can be resumed.");
    }

    const tasks = await ResizeMigrationTaskModel.find({ jobId, userId }).sort({ order: 1 });
    const failedTask = tasks.find((t) => t.status === "failed");
    if (!failedTask) {
        throw new Error("No failed task found to resume.");
    }

    failedTask.status = "pending";
    failedTask.errorCode = undefined;
    failedTask.errorMessage = undefined;
    failedTask.fixSuggestion = undefined;
    failedTask.logs.push({
        level: "info",
        message: "Job resumed by user. Resetting task status to pending.",
        timestamp: new Date()
    });
    await failedTask.save();

    let nextJobStatus: ResizeMigrationJobStatus;
    if (failedTask.key === "preflight") {
        nextJobStatus = "preflight";
    } else if (failedTask.key === "create_source_image") {
        nextJobStatus = "snapshotting";
    } else if (failedTask.key === "launch_target") {
        nextJobStatus = "launching_target";
    } else if (failedTask.key === "validate_target") {
        nextJobStatus = "validating";
    } else if (failedTask.key === "await_cutover" || failedTask.key === "preserve_source") {
        nextJobStatus = "cutover";
        const awaitTask = tasks.find(t => t.key === "await_cutover");
        if (awaitTask && awaitTask.status === "failed") {
            awaitTask.status = "pending";
            await awaitTask.save();
        }
    } else {
        throw new Error(`Cannot resume from task key: ${failedTask.key}`);
    }

    job.status = nextJobStatus;
    job.logs.push({
        level: "info",
        message: `Job resumed. Resuming execution from step: ${failedTask.title}.`,
        timestamp: new Date()
    });
    await job.save();

    if (job.provider === "azure") {
        if (nextJobStatus === "preflight") {
            runAzurePreflightChecks(jobId, userId).catch((err) => {
                console.error(`[Preflight Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "snapshotting") {
            runAzureSnapshotCreation(jobId, userId).catch((err) => {
                console.error(`[Snapshot Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "launching_target") {
            runAzureTargetLaunch(jobId, userId).catch((err) => {
                console.error(`[TargetLaunch Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "validating") {
            runAzureTargetValidation(jobId, userId).catch((err) => {
                console.error(`[TargetValidation Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "cutover") {
            runAzureTargetCutover(jobId, userId).catch((err) => {
                console.error(`[TargetCutover Resumption Error] Job ${jobId}:`, err);
            });
        }
    } else if (job.provider === "gcp") {
        if (nextJobStatus === "preflight") {
            runGcpPreflightChecks(jobId, userId).catch((err) => {
                console.error(`[Preflight Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "snapshotting") {
            runGcpSnapshotCreation(jobId, userId).catch((err) => {
                console.error(`[Snapshot Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "launching_target") {
            runGcpTargetLaunch(jobId, userId).catch((err) => {
                console.error(`[TargetLaunch Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "validating") {
            runGcpTargetValidation(jobId, userId).catch((err) => {
                console.error(`[TargetValidation Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "cutover") {
            runGcpTargetCutover(jobId, userId).catch((err) => {
                console.error(`[TargetCutover Resumption Error] Job ${jobId}:`, err);
            });
        }
    } else {
        if (nextJobStatus === "preflight") {
            runAwsPreflightChecks(jobId, userId).catch((err) => {
                console.error(`[Preflight Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "snapshotting") {
            runAwsAmiCreation(jobId, userId).catch((err) => {
                console.error(`[AmiCreation Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "launching_target") {
            runAwsTargetLaunch(jobId, userId).catch((err) => {
                console.error(`[TargetLaunch Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "validating") {
            runAwsTargetValidation(jobId, userId).catch((err) => {
                console.error(`[TargetValidation Resumption Error] Job ${jobId}:`, err);
            });
        } else if (nextJobStatus === "cutover") {
            runAwsTargetCutover(jobId, userId).catch((err) => {
                console.error(`[TargetCutover Resumption Error] Job ${jobId}:`, err);
            });
        }
    }

    const updatedTasks = await ResizeMigrationTaskModel.find({ jobId, userId }).sort({ order: 1 });
    return { job, tasks: updatedTasks };
}
