import mongoose, { Document, Schema } from "mongoose";
import {
  ResizeMigrationCutoverMode,
  ResizeMigrationJobStatus,
  ResizeMigrationMode,
  ResizeMigrationProvider,
  ResizeMigrationTaskStatus,
  ResizeMigrationAccessMode,
  ResizeMigrationAccessMethod,
  AIExplanationResult,
} from "../../../types/resize-migration.types";

export interface IResizeMigrationJob extends Document {
  userId: string;
  workspaceId?: string;
  provider: ResizeMigrationProvider;
  region: string;
  sourceServerId: string;
  sourceServerName?: string;
  sourceServerType?: string;
  targetServerType: string;
  targetServerId?: string;
  targetServerName?: string;
  status: ResizeMigrationJobStatus;
  mode: ResizeMigrationMode;
  cutoverMode: ResizeMigrationCutoverMode;
  rollbackState?: Record<string, any>;
  sourceSnapshotId?: string;
  sourceImageId?: string;
  logs: IResizeMigrationJobLog[];
  metadata?: Record<string, any>;
  accessMode: ResizeMigrationAccessMode;
  accessConfig?: {
    method?: ResizeMigrationAccessMethod;
    username?: string;
    privateKey?: string;
    port?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface IResizeMigrationJobLog {
  message: string;
  level: "info" | "warning" | "error";
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IResizeMigrationTask extends Document {
  jobId: string;
  userId: string;
  key: string;
  title: string;
  description: string;
  status: ResizeMigrationTaskStatus;
  order: number;
  startedAt?: Date;
  completedAt?: Date;
  logs: IResizeMigrationJobLog[];
  errorCode?: string;
  errorMessage?: string;
  fixSuggestion?: string;
  retryable: boolean;
  fallbackOptions: string[];
  providerRequestId?: string;
  metadata?: Record<string, any>;
  aiExplanation?: AIExplanationResult;
  createdAt: Date;
  updatedAt: Date;
}

const resizeMigrationJobLogSchema = new Schema<IResizeMigrationJobLog>(
  {
    message: { type: String, required: true },
    level: {
      type: String,
      enum: ["info", "warning", "error"],
      default: "info",
    },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const resizeMigrationJobSchema = new Schema<IResizeMigrationJob>(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: String, index: true },
    provider: { type: String, enum: ["aws", "azure", "gcp"], required: true },
    region: { type: String, required: true },
    sourceServerId: { type: String, required: true },
    sourceServerName: { type: String },
    sourceServerType: { type: String },
    targetServerType: { type: String, required: true },
    targetServerId: { type: String },
    targetServerName: { type: String },
    status: {
      type: String,
      enum: [
        "draft",
        "preflight",
        "snapshotting",
        "launching_target",
        "validating",
        "awaiting_cutover",
        "cutover",
        "completed",
        "failed",
        "rolled_back",
      ],
      default: "draft",
      index: true,
    },
    mode: {
      type: String,
      enum: ["clone_and_cutover", "in_place_resize", "assisted_live_sync"],
      default: "clone_and_cutover",
    },
    cutoverMode: {
      type: String,
      enum: ["elastic_ip", "dns", "manual"],
      default: "manual",
    },
    rollbackState: { type: Schema.Types.Mixed },
    sourceSnapshotId: { type: String },
    sourceImageId: { type: String },
    logs: [resizeMigrationJobLogSchema],
    metadata: { type: Schema.Types.Mixed },
    completedAt: { type: Date },
    accessMode: {
      type: String,
      enum: ["cloud_only", "deep_inspection"],
      default: "cloud_only",
    },
    accessConfig: {
      method: {
        type: String,
        enum: ["ssh", "ssm", "azure_run_command", "agent"],
      },
      username: { type: String },
      privateKey: { type: String },
      port: { type: Number },
    },
  },
  { timestamps: true },
);

const resizeMigrationTaskSchema = new Schema<IResizeMigrationTask>(
  {
    jobId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "pending",
        "running",
        "succeeded",
        "failed",
        "skipped",
        "retrying",
      ],
      default: "pending",
      index: true,
    },
    order: { type: Number, required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    logs: [resizeMigrationJobLogSchema],
    errorCode: { type: String },
    errorMessage: { type: String },
    fixSuggestion: { type: String },
    retryable: { type: Boolean, default: false },
    fallbackOptions: [{ type: String }],
    providerRequestId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    aiExplanation: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

resizeMigrationJobSchema.index({ userId: 1, createdAt: -1 });
resizeMigrationJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
resizeMigrationTaskSchema.index({ jobId: 1, order: 1 });
resizeMigrationTaskSchema.index(
  { userId: 1, jobId: 1, key: 1 },
  { unique: true },
);

export const ResizeMigrationJobModel = mongoose.model<IResizeMigrationJob>(
  "ResizeMigrationJob",
  resizeMigrationJobSchema,
);
export const ResizeMigrationTaskModel = mongoose.model<IResizeMigrationTask>(
  "ResizeMigrationTask",
  resizeMigrationTaskSchema,
);

export interface IMigrationErrorPattern extends Document {
  provider: string;
  step: string;
  errorSignature: string;
  errorCode: string;
  likelyCause: string;
  fixSuggestion: string;
  fallbackOption: string;
  retryable: boolean;
  timesSeen: number;
  timesFallbackWorked: number;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const migrationErrorPatternSchema = new Schema<IMigrationErrorPattern>(
  {
    provider: { type: String, required: true, index: true },
    step: { type: String, required: true, index: true },
    errorSignature: { type: String, required: true },
    errorCode: { type: String, required: true },
    likelyCause: { type: String, required: true },
    fixSuggestion: { type: String, required: true },
    fallbackOption: { type: String, required: true },
    retryable: { type: Boolean, default: true },
    timesSeen: { type: Number, default: 0 },
    timesFallbackWorked: { type: Number, default: 0 },
    lastSeenAt: { type: Date },
  },
  { timestamps: true },
);

migrationErrorPatternSchema.index({ provider: 1, step: 1 });

export const MigrationErrorPatternModel =
  mongoose.model<IMigrationErrorPattern>(
    "MigrationErrorPattern",
    migrationErrorPatternSchema,
  );
