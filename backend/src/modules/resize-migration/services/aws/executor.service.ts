import {
    runAwsAmiCreation,
    runAwsTargetLaunch,
    runAwsTargetValidation,
    runAwsTargetCutover
} from "./executors/ec2-executor";
import { runRdsClassModification } from "./executors/rds-executor";
import { ResizeMigrationJobModel } from "../../models/resize-migration.model";

export async function executeAwsJobStep(jobId: string, userId: string, stepKey: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;

    const isRds = job.sourceServerId.startsWith("rds:") || (job.metadata as any)?.computeKind === "aws_rds";

    if (isRds) {
        if (stepKey === "launch_target") {
            await runRdsClassModification(jobId, userId);
        }
    } else {
        if (stepKey === "create_source_image") {
            await runAwsAmiCreation(jobId, userId);
        } else if (stepKey === "launch_target") {
            await runAwsTargetLaunch(jobId, userId);
        } else if (stepKey === "validate_target") {
            await runAwsTargetValidation(jobId, userId);
        } else if (stepKey === "await_cutover") {
            await runAwsTargetCutover(jobId, userId);
        }
    }
}

// Re-export for backward compatibility with existing codebase callers
export {
    runAwsAmiCreation,
    runAwsTargetLaunch,
    runAwsTargetValidation,
    runAwsTargetCutover,
    runRdsClassModification
};