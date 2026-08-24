import { CloudProvider } from "../models/aws.model";

export type ResizeMigrationProvider = Extract<CloudProvider, "aws" | "azure" | "gcp">;
export type ResizeMigrationMode = "clone_and_cutover" | "in_place_resize" | "assisted_live_sync";
export type ResizeMigrationComputeKind = "aws_ec2" | "azure_vm" | "gcp_vm";
export type ResizeMigrationCutoverMode = "elastic_ip" | "dns" | "manual";
export type ResizeMigrationJobStatus =
    | "draft"
    | "preflight"
    | "snapshotting"
    | "launching_target"
    | "validating"
    | "awaiting_cutover"
    | "cutover"
    | "completed"
    | "failed"
    | "rolled_back";
export type ResizeMigrationTaskStatus = "pending" | "running" | "succeeded" | "failed" | "skipped" | "retrying";

export type ResizeMigrationSupportStatus = "mvp" | "later" | "out_of_scope";

export interface ResizeMigrationProviderScope {
    provider: ResizeMigrationProvider;
    computeKind: ResizeMigrationComputeKind;
    status: ResizeMigrationSupportStatus;
    notes: string[];
}

export interface ResizeMigrationModeScope {
    mode: ResizeMigrationMode;
    status: ResizeMigrationSupportStatus;
    notes: string[];
}

export interface ResizeMigrationScopeLock {
    feature: "resize_migration";
    phase: 0;
    lockedAt: string;
    mvpProvider: "aws";
    mvpComputeKind: "aws_ec2";
    mvpMode: "clone_and_cutover";
    sourceDeletionPolicy: "preserve_source_never_delete_in_mvp";
    applicationGuarantee: "cloud_level_only_no_full_app_level_guarantee";
    supportedCutoverModes: ResizeMigrationCutoverMode[];
    providers: ResizeMigrationProviderScope[];
    modes: ResizeMigrationModeScope[];
    nonGoals: string[];
    nextPhase: {
        phase: 1;
        title: "Backend Job And Task Model";
        expectedWork: string[];
    };
}

export type ResizeMigrationAccessMode = "cloud_only" | "deep_inspection";
export type ResizeMigrationAccessMethod = "ssh" | "ssm" | "azure_run_command" | "agent";

export interface ResizeMigrationAccessConfig {
    method?: ResizeMigrationAccessMethod;
    username?: string;
    privateKey?: string;
    port?: number;
}

export interface CreateResizeMigrationJobInput {
    workspaceId?: string;
    provider?: ResizeMigrationProvider;
    region: string;
    sourceServerId: string;
    sourceServerName?: string;
    sourceServerType?: string;
    targetServerType: string;
    targetServerName?: string;
    mode?: ResizeMigrationMode;
    cutoverMode?: ResizeMigrationCutoverMode;
    metadata?: Record<string, unknown>;
    accessMode?: ResizeMigrationAccessMode;
    accessConfig?: ResizeMigrationAccessConfig;
}

export interface ResizeMigrationStatusTransition {
    from: ResizeMigrationJobStatus;
    to: ResizeMigrationJobStatus;
}

export interface AIExplanationResult {
    explanation: string;
    likelyCause: string;
    remediationSteps: string[];
    alternativeFallback: string;
}


