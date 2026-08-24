import mongoose, { Document, Schema } from "mongoose";

export type AnnotationTargetType = "trace" | "span" | "request";
export type AnnotationStatus = "open" | "reviewed" | "resolved" | "ignored";
export type AnnotationSeverity = "low" | "medium" | "high" | "critical";

export interface IAnnotationMetadata extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  targetType: AnnotationTargetType;
  targetId: string;
  traceId?: string | null;
  spanId?: string | null;
  requestId?: string | null;
  status: AnnotationStatus;
  severity?: AnnotationSeverity | null;
  ownerId?: string | null;
  notes?: string;
  tags: string[];
  labels: Record<string, string>;
  feedbackIds: string[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const annotationMetadataSchema = new Schema<IAnnotationMetadata>(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    traceId: { type: String, default: null },
    spanId: { type: String, default: null },
    requestId: { type: String, default: null },
    status: { type: String, default: "open" },
    severity: { type: String, enum: ["low", "medium", "high", "critical", null], default: null },
    ownerId: { type: String, default: null },
    notes: { type: String, default: "" },
    tags: { type: [String], default: [] },
    labels: { type: Schema.Types.Mixed, default: {} },
    feedbackIds: { type: [String], default: [] },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

annotationMetadataSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
annotationMetadataSchema.index({ userId: 1, traceId: 1 }, { sparse: true });
annotationMetadataSchema.index({ userId: 1, spanId: 1 }, { sparse: true });
annotationMetadataSchema.index({ userId: 1, requestId: 1 }, { sparse: true });
annotationMetadataSchema.index({ userId: 1, status: 1, updatedAt: -1 });
annotationMetadataSchema.index({ userId: 1, tags: 1, updatedAt: -1 });
annotationMetadataSchema.index({ userId: 1, severity: 1, updatedAt: -1 });

export const AnnotationMetadata = mongoose.model<IAnnotationMetadata>(
  "AnnotationMetadata",
  annotationMetadataSchema,
);
