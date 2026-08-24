import mongoose, { Schema, Document } from "mongoose";

export interface IAiIngestKey extends Document {
  userId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  lastUsedAt?: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiIngestKeySchema = new Schema<IAiIngestKey>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    prefix: { type: String, required: true, index: true },
    keyHash: { type: String, required: true, unique: true },
    scopes: {
      type: [String],
      required: true,
      default: ["events:write", "traces:write"],
    },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

aiIngestKeySchema.index({ userId: 1, createdAt: -1 });
aiIngestKeySchema.index({ userId: 1, revokedAt: 1 });

export const AiIngestKey = mongoose.model<IAiIngestKey>(
  "AiIngestKey",
  aiIngestKeySchema,
);
