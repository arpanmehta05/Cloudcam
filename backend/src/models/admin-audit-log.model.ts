import mongoose, { Document, Schema } from "mongoose";

export interface IAdminAuditLog extends Document {
  actorId: string; // admin userId who performed the action
  actorEmail?: string | null;
  action: string; // e.g. "plan.create", "tenant.override.set"
  targetType?: string | null; // "plan" | "tenant" | "feature" | "admin"
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: Date;
}

const adminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    actorId: { type: String, required: true, index: true },
    actorEmail: { type: String, default: null },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  // Immutable append-only log; only createdAt matters.
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>(
  "AdminAuditLog",
  adminAuditLogSchema,
);
