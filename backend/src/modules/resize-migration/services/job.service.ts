import {
    IResizeMigrationJob,
    IResizeMigrationTask,
    ResizeMigrationJobModel,
    ResizeMigrationTaskModel,
} from "../models/resize-migration.model";
import {
    CreateResizeMigrationJobInput,
    ResizeMigrationJobStatus,
    ResizeMigrationStatusTransition,
} from "../../../types/resize-migration.types";
import { getResizeMigrationScopeLock } from "./scope.service";
import { triggerBackgroundSteps } from "./job/trigger";
import { checkAndRunScheduledJobs } from "./job/scheduler";
import { resumeResizeMigrationJob } from "./job/resumer";

export { checkAndRunScheduledJobs, resumeResizeMigrationJob };

const allowedJobTransitions: Record<ResizeMigrationJobStatus, ResizeMigrationJobStatus[]> = {
    draft: ["preflight", "failed"],
    preflight: ["snapshotting", "failed"],
    snapshotting: ["launching_target", "failed"],
    launching_target: ["validating", "failed"],
    validating: ["awaiting_cutover", "failed"],
    awaiting_cutover: ["cutover", "rolled_back", "failed", "preflight"],
    cutover: ["completed", "rolled_back", "failed"],
    completed: ["rolled_back"],
    failed: ["preflight", "rolled_back"],
    rolled_back: [],
};

const initialTaskTemplates = [
    {
        key: "preflight",
        title: "Preflight checks",
        description: "Validate credentials, source server, target size, permissions, and cutover options.",
    },
    {
        key: "create_source_image",
        title: "Create source image",
        description: "Create an image or snapshot from the selected source server.",
    },
    {
        key: "launch_target",
        title: "Launch target server",
        description: "Launch a new target server with the selected size and copied cloud configuration.",
    },
    {
        key: "validate_target",
        title: "Validate target server",
        description: "Verify cloud-level health, networking, and target server identifiers.",
    },
    {
        key: "await_cutover",
        title: "Await cutover approval",
        description: "Pause for user approval before Elastic IP, DNS, or manual cutover.",
    },
    {
        key: "preserve_source",
        title: "Preserve source server",
        description: "Keep the original source server available for rollback. The MVP never deletes it.",
    },
];

function cleanString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function validateCreateInput(input: CreateResizeMigrationJobInput): Required<Pick<CreateResizeMigrationJobInput, "provider" | "mode" | "cutoverMode">> {
    const scope = getResizeMigrationScopeLock();
    const provider = input.provider || scope.mvpProvider;
    const mode = input.mode || scope.mvpMode;
    const cutoverMode = input.cutoverMode || "manual";

    if (provider !== "aws" && provider !== "azure" && provider !== "gcp") {
        throw new Error("Only AWS, Azure, and GCP resize migration jobs are supported.");
    }

    if (mode !== scope.mvpMode) {
        throw new Error("Phase 1 only accepts clone-and-cutover migration jobs.");
    }

    if (!scope.supportedCutoverModes.includes(cutoverMode)) {
        throw new Error("Unsupported resize migration cutover mode.");
    }

    if (!cleanString(input.region)) {
        throw new Error("region is required.");
    }

    if (!cleanString(input.sourceServerId)) {
        throw new Error("sourceServerId is required.");
    }

    if (!cleanString(input.targetServerType)) {
        throw new Error("targetServerType is required.");
    }

    return { provider, mode, cutoverMode };
}

export function getAllowedResizeMigrationTransitions(status: ResizeMigrationJobStatus): ResizeMigrationStatusTransition[] {
    return allowedJobTransitions[status].map((nextStatus) => ({ from: status, to: nextStatus }));
}

export function canTransitionResizeMigrationJob(from: ResizeMigrationJobStatus, to: ResizeMigrationJobStatus): boolean {
    return allowedJobTransitions[from].includes(to);
}

export async function createResizeMigrationJob(userId: string, input: CreateResizeMigrationJobInput): Promise<{
    job: IResizeMigrationJob;
    tasks: IResizeMigrationTask[];
}> {
    const { provider, mode, cutoverMode } = validateCreateInput(input);

    const accessMode = input.accessMode || "cloud_only";
    if (accessMode !== "cloud_only" && accessMode !== "deep_inspection") {
        throw new Error("Invalid accessMode. Must be 'cloud_only' or 'deep_inspection'.");
    }

    let accessConfig = undefined;
    if (accessMode === "deep_inspection") {
        if (!input.accessConfig || !input.accessConfig.method) {
            throw new Error("accessConfig.method is required when accessMode is deep_inspection");
        }
        accessConfig = {
            method: input.accessConfig.method,
            username: input.accessConfig.username || "ubuntu",
            privateKey: input.accessConfig.privateKey || "",
            port: input.accessConfig.port || 22,
        };
    }

    const job = await ResizeMigrationJobModel.create({
        userId,
        workspaceId: cleanString(input.workspaceId) || userId,
        provider,
        region: cleanString(input.region),
        sourceServerId: cleanString(input.sourceServerId),
        sourceServerName: cleanString(input.sourceServerName) || undefined,
        sourceServerType: cleanString(input.sourceServerType) || undefined,
        targetServerType: cleanString(input.targetServerType),
        targetServerName: cleanString(input.targetServerName) || undefined,
        status: "draft",
        mode,
        cutoverMode,
        accessMode,
        accessConfig,
        logs: [
            {
                level: "info",
                message: "Resize migration job created as a draft. No cloud-side action has run yet.",
                timestamp: new Date(),
            },
        ],
        metadata: input.metadata || {},
    });

    const tasks = await ResizeMigrationTaskModel.insertMany(
        initialTaskTemplates.map((task, index) => ({
            ...task,
            jobId: job._id.toString(),
            userId,
            order: index + 1,
            status: "pending",
            retryable: false,
            fallbackOptions: [],
            logs: [],
        }))
    );

    return { job, tasks };
}

export async function listResizeMigrationJobs(userId: string): Promise<IResizeMigrationJob[]> {
    return ResizeMigrationJobModel.find({ userId }).sort({ createdAt: -1 }).lean<IResizeMigrationJob[]>();
}

export async function deleteResizeMigrationJob(userId: string, jobId: string): Promise<boolean> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return false;

    await ResizeMigrationTaskModel.deleteMany({ jobId, userId });
    await ResizeMigrationJobModel.deleteOne({ _id: jobId, userId });
    return true;
}

export async function getResizeMigrationJob(userId: string, jobId: string): Promise<{
    job: IResizeMigrationJob;
    tasks: IResizeMigrationTask[];
} | null> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return null;

    const tasks = await ResizeMigrationTaskModel.find({ jobId: job._id.toString(), userId }).sort({ order: 1 });
    return { job, tasks };
}

export async function transitionResizeMigrationJob(
    userId: string,
    jobId: string,
    nextStatus: ResizeMigrationJobStatus
): Promise<IResizeMigrationJob | null> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return null;

    if (!canTransitionResizeMigrationJob(job.status, nextStatus)) {
        throw new Error(`Invalid resize migration status transition from ${job.status} to ${nextStatus}.`);
    }

    if (nextStatus === "preflight") {
        await ResizeMigrationTaskModel.updateMany(
            { jobId, userId },
            {
                $set: {
                    status: "pending",
                    errorCode: undefined,
                    errorMessage: undefined,
                    fixSuggestion: undefined,
                    aiExplanation: undefined,
                    startedAt: undefined,
                    completedAt: undefined,
                    logs: []
                }
            }
        );
    }

    job.status = nextStatus;
    if (nextStatus === "completed" || nextStatus === "rolled_back") {
        job.completedAt = new Date();
    }
    job.logs.push({
        level: "info",
        message: `Job status changed to ${nextStatus}.`,
        timestamp: new Date(),
    });

    await job.save();

    triggerBackgroundSteps(job, jobId, userId, nextStatus);

    return job;
}
