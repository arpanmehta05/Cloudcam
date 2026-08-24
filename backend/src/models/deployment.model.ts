import mongoose, { Schema, Document } from "mongoose";

export type DeploymentStatus =
  | "waiting_creds"
  | "initializing"
  | "provisioning"
  | "running"
  | "awaiting_image_upload"
  | "complete"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface IDeploymentLog {
  line: string;
  source: "stdout" | "stderr";
  timestamp: Date;
}

export interface IDeploymentSession extends Omit<Document, "_id"> {
  _id: string;
  id: string;
  userId: string;
  name?: string;
  draftId?: string;
  nodes: any[];
  edges: any[];
  region: string;
  hcl?: string;
  containerId?: string;
  status: DeploymentStatus;
  errorMessage?: string;
  outputs?: Record<string, any>;
  accountId?: string;
  logs: IDeploymentLog[];
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

const DeploymentLogSchema = new Schema<IDeploymentLog>(
  {
    line: { type: String, required: true },
    source: { type: String, enum: ["stdout", "stderr"], default: "stdout" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const DeploymentSessionSchema = new Schema<IDeploymentSession>(
  {
    _id: { type: String },
    userId: { type: String, required: true },
    name: { type: String },
    draftId: { type: String },
    nodes: [Schema.Types.Mixed],
    edges: [Schema.Types.Mixed],
    region: { type: String, required: true },
    hcl: { type: String },
    containerId: { type: String },
    status: {
      type: String,
      enum: [
        "waiting_creds",
        "initializing",
        "provisioning",
        "running",
        "awaiting_image_upload",
        "complete",
        "failed",
        "cancelled",
        "timed_out",
      ],
      default: "waiting_creds",
    },
    errorMessage: { type: String },
    outputs: { type: Schema.Types.Mixed },
    accountId: { type: String },
    logs: [DeploymentLogSchema],
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

// Index for TTL cleanup
DeploymentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
DeploymentSessionSchema.index({ userId: 1 });

export const DeploymentSessionModel = mongoose.model<IDeploymentSession>(
  "DeploymentSession",
  DeploymentSessionSchema,
);
