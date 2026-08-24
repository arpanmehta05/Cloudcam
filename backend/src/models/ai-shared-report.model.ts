import mongoose, { Document, Schema } from "mongoose";

export type SharedReportType = "overview" | "cost" | "trace" | "evaluation" | "custom";

export interface IAiSharedReport extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  /** Public, unguessable access token embedded in the share link. */
  token: string;
  title: string;
  description?: string | null;
  reportType: SharedReportType;
  /** Immutable data snapshot captured at share time (no re-query on view). */
  snapshot: Record<string, unknown>;
  expiresAt?: Date | null;
  revoked: boolean;
  viewCount: number;
  lastViewedAt?: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiSharedReportSchema = new Schema<IAiSharedReport>(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    token: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    reportType: { type: String, enum: ["overview", "cost", "trace", "evaluation", "custom"], default: "custom" },
    snapshot: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

aiSharedReportSchema.index({ userId: 1, createdAt: -1 });

export const AiSharedReport = mongoose.model<IAiSharedReport>("AiSharedReport", aiSharedReportSchema);
