import mongoose, { Document, Schema } from "mongoose";

export interface IVpsLogAlert extends Document {
  userId: string;
  agentId: string;
  errorSignature: string;
  lastSentAt: Date;
  lastCount: number;
  sample?: string;
  service?: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vpsLogAlertSchema = new Schema<IVpsLogAlert>(
  {
    userId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    errorSignature: { type: String, required: true, index: true },
    lastSentAt: { type: Date, required: true, index: true },
    lastCount: { type: Number, required: true, default: 0 },
    sample: { type: String },
    service: { type: String },
    source: { type: String },
  },
  { timestamps: true },
);

vpsLogAlertSchema.index(
  { userId: 1, agentId: 1, errorSignature: 1 },
  { unique: true },
);

export const VpsLogAlert = mongoose.model<IVpsLogAlert>(
  "VpsLogAlert",
  vpsLogAlertSchema,
);
