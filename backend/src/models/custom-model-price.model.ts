import mongoose, { Document, Schema } from "mongoose";

export type CustomModelPriceMatchPattern = "exact" | "prefix" | "regex";

export interface ICustomModelPrice extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  modelName: string;
  provider: string;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  matchPattern: CustomModelPriceMatchPattern;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customModelPriceSchema = new Schema<ICustomModelPrice>(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    modelName: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true },
    inputPricePerMToken: { type: Number, required: true, min: 0 },
    outputPricePerMToken: { type: Number, required: true, min: 0 },
    matchPattern: {
      type: String,
      enum: ["exact", "prefix", "regex"],
      default: "exact",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customModelPriceSchema.index({ userId: 1, provider: 1, isActive: 1 });
customModelPriceSchema.index({ userId: 1, modelName: 1, provider: 1 });

export const CustomModelPrice = mongoose.model<ICustomModelPrice>(
  "CustomModelPrice",
  customModelPriceSchema,
);
