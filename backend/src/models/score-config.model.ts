import mongoose, { Document, Schema } from "mongoose";

export type ScoreConfigDataType = "numeric" | "categorical" | "boolean" | "text";

export interface IScoreConfig extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  name: string;
  dataType: ScoreConfigDataType;
  minValue?: number | null;
  maxValue?: number | null;
  categories: string[];
  description?: string;
  isArchived: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scoreConfigSchema = new Schema<IScoreConfig>(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    dataType: {
      type: String,
      enum: ["numeric", "categorical", "boolean", "text"],
      required: true,
    },
    minValue: { type: Number, default: null },
    maxValue: { type: Number, default: null },
    categories: { type: [String], default: [] },
    description: { type: String, default: "" },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

scoreConfigSchema.index(
  { userId: 1, name: 1, workspaceId: 1 },
  { unique: true },
);
scoreConfigSchema.index({ userId: 1, isArchived: 1 });

export const ScoreConfig = mongoose.model<IScoreConfig>(
  "ScoreConfig",
  scoreConfigSchema,
);
