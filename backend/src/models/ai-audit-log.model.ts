import mongoose, { Document, Schema } from "mongoose";

export type AuditResourceType =
  | "ingest_key"
  | "prompt"
  | "dataset"
  | "evaluation"
  | "evaluator"
  | "score_config"
  | "annotation_queue"
  | "pricing"
  | "budget"
  | "export"
  | "retention"
  | "redaction"
  | "comment"
  | "prompt_approval"
  | "webhook"
  | "report";

export interface IAiAuditLog extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  actorId: string;
  action: string; // e.g. "prompt.promote", "ingest_key.revoke"
  resourceType: AuditResourceType;
  resourceId?: string | null;
  resourceName?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiAuditLogSchema = new Schema<IAiAuditLog>(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: null },
    resourceName: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true },
);

aiAuditLogSchema.index({ userId: 1, createdAt: -1 });
aiAuditLogSchema.index({ userId: 1, resourceType: 1, createdAt: -1 });
aiAuditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });

export const AiAuditLog = mongoose.model<IAiAuditLog>("AiAuditLog", aiAuditLogSchema);
