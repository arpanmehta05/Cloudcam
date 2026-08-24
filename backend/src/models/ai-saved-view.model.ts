import mongoose, { Document, Schema } from "mongoose";

export type AiSavedViewType = "traces" | "observations";

export interface IAiSavedView extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  name: string;
  viewType: AiSavedViewType;
  query: string;
  filters: Record<string, unknown>;
  columns: string[];
  sort: Record<string, unknown>;
  isDefault: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiSavedViewSchema = new Schema<IAiSavedView>(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    name: { type: String, required: true },
    viewType: { type: String, enum: ["traces", "observations"], required: true },
    query: { type: String, default: "" },
    filters: { type: Schema.Types.Mixed, default: {} },
    columns: { type: [String], default: [] },
    sort: { type: Schema.Types.Mixed, default: {} },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

aiSavedViewSchema.index({ userId: 1, workspaceId: 1, viewType: 1, updatedAt: -1 });
aiSavedViewSchema.index(
  { userId: 1, workspaceId: 1, viewType: 1, name: 1 },
  { unique: true },
);
aiSavedViewSchema.index({ userId: 1, workspaceId: 1, viewType: 1, isDefault: 1 });

export const AiSavedView = mongoose.model<IAiSavedView>("AiSavedView", aiSavedViewSchema);
