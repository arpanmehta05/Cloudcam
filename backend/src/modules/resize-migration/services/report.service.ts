import { IResizeMigrationJob, IResizeMigrationTask } from "../models/resize-migration.model";
import { generateReportPdf } from "../../../services/usage-report.service";

type AccessProfile = {
    keyPairName?: string | null;
    suggestedUsername?: string | null;
    imageId?: string | null;
    imageName?: string | null;
    platformDetails?: string | null;
    hasUserData?: boolean;
    reusedSourceKeyPair?: boolean;
    launchedFromImageId?: string | null;
    launchedFromImageName?: string | null;
    userDataCopied?: boolean;
    publicIp?: string | null;
    privateIp?: string | null;
    publicDnsName?: string | null;
};

function formatDate(value: Date | string | null | undefined) {
    if (!value) return "Pending";
    return new Date(value).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    }) + " (UTC)";
}

function formatDuration(start?: Date | string, end?: Date | string) {
    if (!start || !end) return "Pending";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (Number.isNaN(ms) || ms < 0) return "Pending";

    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
}

function titleCase(value: string) {
    return value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function plainText(value: unknown) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(value: unknown, limit = 180) {
    const text = plainText(value);
    return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function collectAccessProfiles(job: IResizeMigrationJob) {
    const metadata = (job.metadata || {}) as {
        sourceAccessProfile?: AccessProfile;
        targetAccessProfile?: AccessProfile;
        classification?: { classification?: string; confidence?: string; signals?: string[] };
    };

    return {
        source: metadata.sourceAccessProfile || {},
        target: metadata.targetAccessProfile || {},
        classification: metadata.classification || {},
    };
}

function getAccent(status: string) {
    if (status === "completed") return "#059669";
    if (status === "failed") return "#DC2626";
    if (status === "awaiting_cutover" || status === "cutover") return "#D97706";
    return "#2563EB";
}

function buildChecklistRows(job: IResizeMigrationJob, tasks: IResizeMigrationTask[]) {
    const createImageTask = tasks.find((task) => task.key === "create_source_image");
    const launchTask = tasks.find((task) => task.key === "launch_target");
    const validateTask = tasks.find((task) => task.key === "validate_target");
    const preserveTask = tasks.find((task) => task.key === "preserve_source");
    const validationLogs = validateTask?.logs || [];
    const hasNginxSuccess = validationLogs.some((log) => /nginx/i.test(log.message) && /successful|syntax is ok|passed|clean/i.test(log.message));
    const hasDependencyEvidence = validationLogs.some((log) => /docker|container|systemd|pm2|redis|postgres/i.test(log.message));

    const stateFor = (task?: IResizeMigrationTask) => {
        if (!task) return "Pending";
        if (task.status === "succeeded") return "Done";
        if (task.status === "failed") return "Undone";
        if (task.status === "skipped") return "Done";
        return "Pending";
    };

    return [
        [
            "Server spun up",
            job.targetServerId ? "Done" : stateFor(launchTask),
            job.targetServerId ? "Target instance or VM exists and has a launched server identifier." : "Target server has not been created yet.",
        ],
        [
            "Source image copied",
            job.sourceImageId || job.sourceSnapshotId ? "Done" : stateFor(createImageTask),
            job.sourceImageId || job.sourceSnapshotId
                ? `Clone artifact ready: ${job.sourceImageId || job.sourceSnapshotId}.`
                : "No source image or snapshot artifact is recorded yet.",
        ],
        [
            "Dependencies verified",
            job.accessMode === "deep_inspection" ? (hasDependencyEvidence ? "Done" : stateFor(validateTask)) : "Manual",
            job.accessMode === "deep_inspection"
                ? (hasDependencyEvidence ? "Validation logs include service or runtime evidence from inside the target." : "Deep inspection did not yet capture dependency confirmation.")
                : "Cloud-only mode cannot prove PM2, packages, or service dependencies from inside the server.",
        ],
        [
            "Nginx configuration checked",
            job.accessMode === "deep_inspection" ? (hasNginxSuccess ? "Done" : stateFor(validateTask)) : "Manual",
            job.accessMode === "deep_inspection"
                ? (hasNginxSuccess ? "Validation logs include a successful Nginx configuration check." : "No successful Nginx validation evidence has been captured yet.")
                : "Cloud-only mode cannot verify whether the Nginx configuration changed or still matches the source server.",
        ],
        [
            "Source preservation state",
            preserveTask ? stateFor(preserveTask) : (["completed", "rolled_back"].includes(job.status) ? "Done" : "Pending"),
            job.metadata?.stopSourceAfterCutover
                ? "Source server is configured to stop after cutover."
                : "Source server is configured to remain preserved for rollback.",
        ],
    ];
}

export function generateMigrationReport(
    job: IResizeMigrationJob,
    tasks: IResizeMigrationTask[]
): Promise<Buffer> {
    const access = collectAccessProfiles(job);
    const completedTasks = tasks.filter((task) => task.status === "succeeded").length;
    const sshHost = access.target.publicDnsName || access.target.publicIp || access.target.privateIp || "Pending";
    const sshUser = access.target.suggestedUsername || access.source.suggestedUsername || job.accessConfig?.username || "Validate manually";
    const classification = access.classification.classification
        ? `${access.classification.classification}${access.classification.confidence ? ` (${access.classification.confidence} confidence)` : ""}`
        : "Not confirmed";
    const signals = access.classification.signals?.length
        ? truncateText(access.classification.signals.join(", "), 220)
        : "No classification signals recorded";

    const sections = [
        {
            title: "Migration Summary",
            rows: [
                ["Job ID", job._id.toString(), "Primary audit reference"],
                ["Provider", titleCase(job.provider), `Region ${job.region}`],
                ["Status", titleCase(job.status), `${completedTasks}/${tasks.length} tasks completed`],
                ["Source Server", job.sourceServerName || job.sourceServerId, job.sourceServerType || "Unknown source type"],
                ["Target Server", job.targetServerId || "Pending launch", job.targetServerType],
                ["Cutover", titleCase(job.cutoverMode), job.accessMode === "deep_inspection" ? `Deep inspection via ${job.accessConfig?.method || "configured method"}` : "Cloud-only migration"],
                ["Created", formatDate(job.createdAt), `Completed ${formatDate(job.completedAt)}`],
            ],
        },
        {
            title: "Access And Host Details",
            rows: [
                ["Detected Source Image", access.source.platformDetails || access.source.imageName || access.source.imageId || "Not captured", "Cloud image metadata"],
                ["SSH Username Hint", sshUser, "Use this instead of a generic provider default when SSHing"],
                ["Target Host", sshHost, "Preferred target host for operator access"],
                ["Key Pair", access.target.keyPairName || access.source.keyPairName || "No EC2 key pair detected", access.target.reusedSourceKeyPair ? "Source key pair reused for the target" : "Key pair reuse not confirmed"],
                ["Bootstrap", access.target.userDataCopied ? "Source user-data copied" : access.source.hasUserData ? "Source had user-data; target copy not confirmed" : "No source user-data found", "Post-boot automation context"],
                ["Generated SSH", sshHost === "Pending" ? "Pending target host" : `ssh -i "<your-key>" ${sshUser}@${sshHost}`, "Replace the key placeholder with the actual PEM or private key file"],
            ],
        },
        {
            title: "Work Checklist",
            rows: buildChecklistRows(job, tasks),
        },
        {
            title: "Validation Summary",
            rows: [
                ["Classification", classification, signals],
                ["Launch Artifact", access.target.launchedFromImageId || job.sourceImageId || job.sourceSnapshotId || "Pending", access.target.launchedFromImageName || access.source.imageName || "Artifact name unavailable"],
                ["Public IP", access.target.publicIp || "Pending", access.target.publicDnsName || "DNS pending"],
                ["Private IP", access.target.privateIp || "Pending", "Internal access path"],
            ],
        },
        {
            title: "Task Timeline",
            rows: tasks.map((task) => [
                task.title,
                titleCase(task.status),
                `${truncateText(task.description, 90)} | Duration: ${formatDuration(task.startedAt, task.completedAt)}`,
            ]),
        },
        {
            title: "Detailed Logs",
            rows: tasks.flatMap((task) => {
                if (!task.logs?.length) {
                    return [[task.title, "No logs", "No execution logs were recorded for this task."]];
                }

                return task.logs.map((log) => [
                    task.title,
                    log.level.toUpperCase(),
                    `${new Date(log.timestamp).toLocaleTimeString("en-US")} | ${truncateText(log.message, 180)}`,
                ]);
            }),
        },
    ];

    return generateReportPdf({
        title: "Resize Migration Audit Report",
        subtitle: `${titleCase(job.provider)} server clone, validation, SSH access details, and operator-ready migration evidence.`,
        generatedAt: job.updatedAt || job.createdAt,
        accent: getAccent(job.status),
        kpis: [
            {
                label: "Overall Status",
                value: titleCase(job.status),
                note: `${completedTasks}/${tasks.length} tasks completed`,
            },
            {
                label: "Source To Target",
                value: `${job.sourceServerType || "Unknown"} -> ${job.targetServerType}`,
                note: titleCase(job.provider),
            },
            {
                label: "SSH Login",
                value: sshUser,
                note: sshHost,
            },
        ],
        sections,
    });
}
