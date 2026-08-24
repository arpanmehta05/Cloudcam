import mongoose, { Document, Schema } from "mongoose";

export type VpsLogSource = "docker" | "pm2" | "system" | "nginx" | "apache";
export type VpsLogLevel = "error" | "warn" | "info" | "debug";

export interface IVpsLogEntry extends Document {
  userId: string;
  agentId: string;
  source: VpsLogSource;
  service: string;
  level: VpsLogLevel;
  message: string;
  timestamp: Date;
  errorSignature?: string;
  metadata?: Record<string, any>;
}

const vpsLogEntrySchema = new Schema<IVpsLogEntry>(
  {
    userId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ["docker", "pm2", "system", "nginx", "apache"],
      required: true,
    },
    service: { type: String, required: true, default: "unknown" },
    level: {
      type: String,
      enum: ["error", "warn", "info", "debug"],
      default: "info",
    },
    message: { type: String, required: true },
    timestamp: { type: Date, required: true },
    errorSignature: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

vpsLogEntrySchema.index({ userId: 1, timestamp: -1 });
vpsLogEntrySchema.index({ userId: 1, level: 1, timestamp: -1 });
vpsLogEntrySchema.index({ userId: 1, errorSignature: 1, timestamp: -1 });
vpsLogEntrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const VpsLogEntry = mongoose.model<IVpsLogEntry>(
  "VpsLogEntry",
  vpsLogEntrySchema,
);
