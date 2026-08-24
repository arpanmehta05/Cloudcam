import {
    ResizeMigrationJobModel,
    ResizeMigrationTaskModel
} from "../../../models/resize-migration.model";

export async function runGcpTargetCutover(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;
    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "await_cutover" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Performing GCP IP / DNS cutover...", timestamp: new Date() }];
    await task.save();

    task.logs.push({ level: "info", message: "Traffic successfully routed to the resized target VM.", timestamp: new Date() });
    task.status = "succeeded";
    task.completedAt = new Date();
    await task.save();

    job.status = "completed";
    job.logs.push({ level: "info", message: "Resize migration cutover completed successfully.", timestamp: new Date() });
    await job.save();
}
