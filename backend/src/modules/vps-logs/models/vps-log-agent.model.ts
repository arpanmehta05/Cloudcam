import mongoose, { Document, Schema } from "mongoose";

export interface IVpsLogAgent extends Document {
  userId: string;
  name: string;
  vpcId?: string;
  environment?: string;
  agentId: string;
  ingestKeyHash: string;
  collectionInterval: number; // in seconds
  enabledSources: string[]; // e.g. ["docker", "pm2", "system", "nginx", "apache"]
  status: "active" | "inactive" | "pending";
  lastSeenAt?: Date;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const vpsLogAgentSchema = new Schema<IVpsLogAgent>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    vpcId: { type: String, default: "" },
    environment: { type: String, default: "" },
    agentId: { type: String, required: true, unique: true, index: true },
    ingestKeyHash: { type: String, required: true },
    collectionInterval: { type: Number, default: 300 }, // default 5 minutes
    enabledSources: {
      type: [String],
      default: ["docker", "pm2", "system", "nginx", "apache"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "pending",
    },
    lastSeenAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

vpsLogAgentSchema.index({ userId: 1, agentId: 1 }, { unique: true });

export const VpsLogAgent = mongoose.model<IVpsLogAgent>(
  "VpsLogAgent",
  vpsLogAgentSchema,
);
