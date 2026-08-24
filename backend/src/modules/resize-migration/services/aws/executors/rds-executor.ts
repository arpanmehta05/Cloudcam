import { RDSClient, ModifyDBInstanceCommand } from "@aws-sdk/client-rds";
import { getCredentials } from "@/store/workspace-credentials";
import { getClientConfig } from "@/providers/aws/client-factory";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "@/modules/resize-migration/models/resize-migration.model";
import { matchAndEnrichTaskError } from "@/modules/resize-migration/services/error-kb.service";

export async function runRdsClassModification(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
        console.error(`[RdsResize] Job ${jobId} not found.`);
        return;
    }

    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "launch_target" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Starting RDS class modification...", timestamp: new Date() }];
    await task.save();

    try {
        const region = job.region;
        const creds = await getCredentials(userId, "aws");
        if (!creds || !creds.roleArn || !creds.externalId) {
            throw new Error("AWS credentials not found or incomplete.");
        }

        const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
        const rds = new RDSClient(cfg);

        task.logs.push({
            level: "info",
            message: `Modifying RDS instance ${job.sourceServerId} class to ${job.targetServerType}...`,
            timestamp: new Date()
        });
        await task.save();

        await rds.send(new ModifyDBInstanceCommand({
            DBInstanceIdentifier: job.sourceServerId,
            DBInstanceClass: job.targetServerType,
            ApplyImmediately: true
        }));

        task.logs.push({
            level: "info",
            message: "RDS modification command sent successfully. Applying class change immediately.",
            timestamp: new Date()
        });
        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "completed");
    } catch (err: any) {
        console.error(`[RDS modification failure] Job ${jobId}:`, err);
        await matchAndEnrichTaskError("aws", "launch_target", err, task);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "failed");
    }
}
