import mongoose, { Schema, Document } from "mongoose";

export interface ISecurityEvent extends Document {
  userId: string;
  action: string;
  ip: string;
  userAgent: string;
  details?: string;
  createdAt: Date;
  updatedAt: Date;
}

const securityEventSchema = new Schema<ISecurityEvent>(
  {
    userId: { type: String, required: true },
    action: { type: String, required: true },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    details: { type: String },
  },
  { timestamps: true },
);

// Indexes: lookup events for a user sorted by most recent first
securityEventSchema.index({ userId: 1, createdAt: -1 });

export const SecurityEvent = mongoose.model<ISecurityEvent>(
  "SecurityEvent",
  securityEventSchema,
);
