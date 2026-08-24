import {
  ChecklistItem,
  JobLog,
  MigrationJob,
  MigrationTask,
  SourceServer,
} from "../types";

export type TerminalLog = JobLog & { scope: string };

const ACTIVE_JOB_STATUSES = [
  "draft",
  "preflight",
  "snapshotting",
  "launching_target",
  "validating",
  "awaiting_cutover",
  "cutover",
];

const HOST_PATTERN =
  /((?:[a-z0-9-]+\.)+(?:amazonaws\.com|cloudapp\.azure\.com|azure\.com)|(?:\d{1,3}\.){3}\d{1,3})/i;

export function getRunningServers(sources: SourceServer[]) {
  return sources.filter((source) => source.state === "running");
}

export function getActiveRegions(runningServers: SourceServer[]) {
  return Array.from(
    new Set(runningServers.map((server) => server.region).filter(Boolean))
  );
}

export function getFilteredSources(sources: SourceServer[], region: string) {
  return sources.filter(
    (source) => source.region === region && source.state === "running"
  );
}

export function getFilteredJobs(
  jobs: MigrationJob[],
  filterTab: "all" | "active" | "archived"
) {
  return jobs.filter((job) => {
    const isActive = ACTIVE_JOB_STATUSES.includes(job.status);
    if (filterTab === "active") return isActive;
    if (filterTab === "archived") return !isActive;
    return true;
  });
}

export function getTaskSummary(
  activeTasks: MigrationTask[],
  expandedTaskId: string | null
) {
  const completedTaskCount = activeTasks.filter((task) =>
    ["succeeded", "skipped"].includes(task.status)
  ).length;
  const failedTaskCount = activeTasks.filter(
    (task) => task.status === "failed"
  ).length;
  const runningTask =
    activeTasks.find(
      (task) => task.status === "running" || task.status === "retrying"
    ) || null;
  const pendingTaskCount = activeTasks.filter((task) =>
    ["pending", "running", "retrying"].includes(task.status)
  ).length;
  const progressPercent =
    activeTasks.length > 0
      ? Math.round((completedTaskCount / activeTasks.length) * 100)
      : 0;
  const expandedTask =
    activeTasks.find((task) => task.key === expandedTaskId) ||
    runningTask ||
    activeTasks[0] ||
    null;
  const latestFailedTask =
    activeTasks.find((task) => task.status === "failed") || null;

  return {
    completedTaskCount,
    failedTaskCount,
    runningTask,
    pendingTaskCount,
    progressPercent,
    expandedTask,
    latestFailedTask,
  };
}

export function getTargetHost(
  activeJob: MigrationJob | null,
  activeTasks: MigrationTask[]
) {
  if (!activeJob) return null;

  return (
    activeJob.metadata?.targetAccessProfile?.publicDnsName ||
    activeJob.metadata?.targetAccessProfile?.publicIp ||
    activeJob.metadata?.targetAccessProfile?.privateIp ||
    getLogDerivedTargetHost(activeJob, activeTasks)
  );
}

export function getGeneratedSshCommand(
  activeJob: MigrationJob | null,
  targetHost: string | null,
  customSshUsername: string,
  customSshKeyName: string
) {
  if (!activeJob) return "";

  const sshUser =
    customSshUsername || (activeJob.provider === "aws" ? "ubuntu" : "azureuser");
  const host = targetHost || "<target-ip-address>";
  const keyFile = customSshKeyName ? `${customSshKeyName}.pem` : "keypair.pem";

  return `ssh -i "${keyFile}" ${sshUser}@${host}`;
}

export function getChecklistItems(
  activeJob: MigrationJob | null,
  activeTasks: MigrationTask[],
  targetHost: string | null
): ChecklistItem[] {
  if (!activeJob) return [];

  const createImageTask = activeTasks.find(
    (task) => task.key === "create_source_image"
  );
  const launchTask = activeTasks.find((task) => task.key === "launch_target");
  const validateTask = activeTasks.find(
    (task) => task.key === "validate_target"
  );
  const preserveTask = activeTasks.find((task) => task.key === "preserve_source");
  const validationLogs = validateTask?.logs || [];
  const hasNginxSuccess = validationLogs.some(
    (log) =>
      /nginx/i.test(log.message) &&
      /successful|syntax is ok|passed|clean/i.test(log.message)
  );
  const hasDependencyEvidence = validationLogs.some((log) =>
    /docker|container|systemd|pm2|redis|postgres/i.test(log.message)
  );

  return [
    {
      label: "Server spun up",
      detail: activeJob.targetServerId
        ? "Target instance or VM exists and has an assigned migration target ID."
        : "Target server has not been created yet.",
      state: activeJob.targetServerId ? "done" : resolveTaskState(launchTask),
    },
    {
      label: "Source image copied",
      detail:
        activeJob.sourceImageId || activeJob.sourceSnapshotId
          ? `Clone artifact ready: ${
              activeJob.sourceImageId || activeJob.sourceSnapshotId
            }.`
          : "No source image or snapshot artifact has been recorded yet.",
      state:
        activeJob.sourceImageId || activeJob.sourceSnapshotId
          ? "done"
          : resolveTaskState(createImageTask),
    },
    {
      label: "SSH path prepared",
      detail: targetHost
        ? `Generated command uses ${
            activeJob.metadata?.targetAccessProfile?.suggestedUsername ||
            activeJob.accessConfig?.username ||
            "detected"
          } and ${targetHost}.`
        : "Command is shown with a target IP placeholder until CloudWatcher records the target address.",
      state: targetHost ? "done" : "pending",
    },
    {
      label: "Dependencies verified",
      detail:
        activeJob.accessMode === "deep_inspection"
          ? hasDependencyEvidence
            ? "Deep inspection found service or container/runtime evidence on the target."
            : "Deep inspection is enabled, but dependency verification evidence has not been captured yet."
          : "Cloud-only mode cannot confirm PM2, packages, or service dependencies from inside the server.",
      state:
        activeJob.accessMode === "deep_inspection"
          ? hasDependencyEvidence
            ? "done"
            : resolveTaskState(validateTask)
          : "manual",
    },
    {
      label: "Nginx configuration checked",
      detail:
        activeJob.accessMode === "deep_inspection"
          ? hasNginxSuccess
            ? "Target validation logs include a successful Nginx configuration check."
            : "No successful Nginx validation evidence has been captured yet."
          : "Cloud-only mode cannot verify whether the Nginx configuration changed or still matches the source server.",
      state:
        activeJob.accessMode === "deep_inspection"
          ? hasNginxSuccess
            ? "done"
            : resolveTaskState(validateTask)
          : "manual",
    },
    {
      label: "Source preservation state",
      detail: activeJob.metadata?.stopSourceAfterCutover
        ? "Source server is configured to stop after cutover."
        : "Source server is configured to remain preserved for rollback.",
      state: preserveTask
        ? resolveTaskState(preserveTask)
        : ["completed", "rolled_back"].includes(activeJob.status)
        ? "done"
        : "pending",
    },
  ];
}

export function getRegionLabel(prov: string, reg: string) {
  if (prov === "aws") {
    if (reg === "ap-south-1") return "Mumbai (ap-south-1)";
    if (reg === "us-east-1") return "N. Virginia (us-east-1)";
    if (reg === "us-west-2") return "Oregon (us-west-2)";
    if (reg === "eu-west-1") return "Ireland (eu-west-1)";
  } else if (prov === "azure") {
    if (reg === "centralindia") return "Central India (centralindia)";
    if (reg === "eastus") return "East US (eastus)";
    if (reg === "westus2") return "West US 2 (westus2)";
    if (reg === "westeurope") return "West Europe (westeurope)";
  } else if (prov === "gcp") {
    if (reg === "us-central1") return "Iowa (us-central1)";
    if (reg === "us-east1") return "South Carolina (us-east1)";
    if (reg === "europe-west1") return "Belgium (europe-west1)";
    if (reg === "asia-south1") return "Mumbai (asia-south1)";
  }
  return reg;
}

export function getConsoleLogs(
  activeJob: MigrationJob | null,
  activeTasks: MigrationTask[]
): TerminalLog[] {
  return [
    ...(activeJob?.logs || []).map((log) => ({
      ...log,
      scope: "Migration event",
    })),
    ...activeTasks.flatMap((task) =>
      (task.logs || []).map((log) => ({ ...log, scope: task.title }))
    ),
  ]
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    .slice(-40);
}

export function getFilteredTerminalLogs(
  consoleLogs: TerminalLog[],
  selectedLogLevel: "all" | "info" | "warning" | "error"
) {
  return consoleLogs.filter((log) => {
    if (selectedLogLevel === "all") return true;
    return log.level === selectedLogLevel;
  });
}

function getLogDerivedTargetHost(
  activeJob: MigrationJob,
  activeTasks: MigrationTask[]
) {
  const logs = [
    ...(activeJob.logs || []),
    ...activeTasks.flatMap((task) => task.logs || []),
  ].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const preferredLog = logs.find((log) => {
    const message = log.message.toLowerCase();
    return (
      /target|launched|public|connect|ssh|host|ip|dns/.test(message) &&
      !(/source/.test(message) && !/target/.test(message)) &&
      HOST_PATTERN.test(log.message)
    );
  });

  const fallbackLog = logs.find((log) => HOST_PATTERN.test(log.message));
  const match = (preferredLog || fallbackLog)?.message.match(HOST_PATTERN);
  const candidate = match?.[1]?.replace(/[),.;\]]+$/, "");

  return candidate && isValidIp(candidate) ? candidate : null;
}

function isValidIp(candidate: string) {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(candidate)) return true;
  return candidate
    .split(".")
    .every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function resolveTaskState(task?: MigrationTask): ChecklistItem["state"] {
  if (
    !task ||
    task.status === "pending" ||
    task.status === "running" ||
    task.status === "retrying"
  ) {
    return "pending";
  }
  if (task.status === "failed") return "undone";
  if (task.status === "succeeded" || task.status === "skipped") return "done";
  return "pending";
}
