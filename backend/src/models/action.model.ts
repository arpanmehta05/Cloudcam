// ─── Action Agent Data Models ───
import mongoose, { Schema, Document } from "mongoose";

// Permission levels for workspaces
export type PermissionLevel = "read_only" | "dry_run_only" | "full_actions";

// Action request statuses
export type ActionStatus =
  | "created"
  | "pending_review"
  | "approved"
  | "executing"
  | "completed"
  | "partially_failed"
  | "failed"
  | "rolled_back"
  | "simulated";

export type TargetExecutionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "failed"
  | "rolled_back"
  | "rollback_failed";

// Risk levels
export type RiskLevel = "low" | "medium" | "high" | "critical";

// ─── ActionRequest Schema ───
export interface IActionRequest extends Document {
  userId: string;
  actionId: string;
  displayName: string;
  service: string;
  targets: {
    resourceId: string;
    resourceName: string;
    region: string;
    currentState?: string;
    proposedState?: string;
    status?: TargetExecutionStatus;
    executionResult?: Record<string, any>;
    errorMessage?: string;
    rolledBackAt?: Date;
  }[];
  status: ActionStatus;
  riskLevel: RiskLevel;
  reversible: boolean;
  estimatedSavings: number;
  reasoning?: string;
  dryRunResult?: Record<string, any>;
  preActionSnapshot?: Record<string, any>;
  postActionResult?: Record<string, any>;
  rollbackData?: Record<string, any>;
  safetyWarnings: string[];
  dependencyWarnings: string[];
  downtimeWarning?: string;
  simulationMode: boolean;
  createdAt: Date;
  approvedAt?: Date;
  executedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  rolledBackAt?: Date;
  errorMessage?: string;
}

const actionRequestSchema = new Schema<IActionRequest>(
  {
    userId: { type: String, required: true, index: true },
    actionId: { type: String, required: true },
    displayName: { type: String, required: true },
    service: { type: String, required: true },
    targets: [
      {
        resourceId: { type: String, required: true },
        resourceName: { type: String, default: "" },
        region: { type: String, required: true },
        currentState: String,
        proposedState: String,
        status: {
          type: String,
          enum: [
            "pending",
            "executing",
            "completed",
            "failed",
            "rolled_back",
            "rollback_failed",
          ],
          default: "pending",
        },
        executionResult: Schema.Types.Mixed,
        errorMessage: String,
        rolledBackAt: Date,
      },
    ],
    status: {
      type: String,
      enum: [
        "created",
        "pending_review",
        "approved",
        "executing",
        "completed",
        "partially_failed",
        "failed",
        "rolled_back",
        "simulated",
      ],
      default: "pending_review",
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    reversible: { type: Boolean, default: false },
    estimatedSavings: { type: Number, default: 0 },
    reasoning: String,
    dryRunResult: { type: Schema.Types.Mixed },
    preActionSnapshot: { type: Schema.Types.Mixed },
    postActionResult: { type: Schema.Types.Mixed },
    rollbackData: { type: Schema.Types.Mixed },
    safetyWarnings: [{ type: String }],
    dependencyWarnings: [{ type: String }],
    downtimeWarning: String,
    simulationMode: { type: Boolean, default: false },
    approvedAt: Date,
    executedAt: Date,
    completedAt: Date,
    failedAt: Date,
    rolledBackAt: Date,
    errorMessage: String,
  },
  { timestamps: true },
);

actionRequestSchema.index({ userId: 1, createdAt: -1 });
actionRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const ActionRequest = mongoose.model<IActionRequest>(
  "ActionRequest",
  actionRequestSchema,
);

// ─── AuditLog Schema ───
export type AuditEvent =
  | "plan_created"
  | "preview_requested"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "rolled_back"
  | "simulated";

export interface IAuditLog extends Document {
  event: AuditEvent;
  userId: string;
  actionId: string;
  requestId: string;
  targets: string[];
  changes: Record<string, any>[];
  metadata?: Record<string, any>;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  event: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  actionId: { type: String, required: true },
  requestId: { type: String, required: true, index: true },
  targets: [String],
  changes: [Schema.Types.Mixed],
  metadata: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ userId: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

// ─── SavingsRecord Schema — tracks realized savings post-action ───
export interface ISavingsRecord extends Document {
  userId: string;
  actionRequestId: string;
  actionId: string;
  service: string;
  estimatedMonthlySavings: number;
  actualMonthlySavings?: number;
  verifiedAt?: Date;
  feedbackNotes?: string;
  createdAt: Date;
}

const savingsRecordSchema = new Schema<ISavingsRecord>(
  {
    userId: { type: String, required: true, index: true },
    actionRequestId: { type: String, required: true },
    actionId: { type: String, required: true },
    service: { type: String, required: true },
    estimatedMonthlySavings: { type: Number, required: true },
    actualMonthlySavings: Number,
    verifiedAt: Date,
    feedbackNotes: String,
  },
  { timestamps: true },
);

savingsRecordSchema.index({ userId: 1, verifiedAt: -1, createdAt: -1 });
savingsRecordSchema.index({ userId: 1, actionRequestId: 1 }, { unique: true });

export const SavingsRecord = mongoose.model<ISavingsRecord>(
  "SavingsRecord",
  savingsRecordSchema,
);
