import mongoose, { Document, Schema } from "mongoose";

export interface IVpsAlertPolicy extends Document {
  userId: string;
  errorSignatureThreshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const vpsAlertPolicySchema = new Schema<IVpsAlertPolicy>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    errorSignatureThreshold: { type: Number, default: 25 },
    windowMinutes: { type: Number, default: 15 },
    cooldownMinutes: { type: Number, default: 60 },
  },
  { timestamps: true },
);

export const VpsAlertPolicy = mongoose.model<IVpsAlertPolicy>(
  "VpsAlertPolicy",
  vpsAlertPolicySchema,
);
