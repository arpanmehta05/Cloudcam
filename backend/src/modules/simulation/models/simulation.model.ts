import mongoose, { Schema, Document } from "mongoose";

export type SimulationStatus =
  | "pending"
  | "starting"
  | "provisioning"
  | "configuring"
  | "initializing"
  | "checking"
  | "ready"
  | "error"
  | "terminated"
  | "timed_out";

export interface ISimulationStep {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  startedAt?: Date;
  completedAt?: Date;
}

export interface ISimulationConfig {
  region: string;
  services: string[];
  userId: string;
}

export interface ISimulationSession extends Document {
  id: string;
  status: SimulationStatus;
  steps: ISimulationStep[];
  progress: number;
  config: ISimulationConfig;
  orchestrator: "local" | "ecs";
  createdAt: Date;
  expiresAt: Date;
  startedAt?: Date;
  readyAt?: Date;
  terminatedAt?: Date;
  errorMessage?: string;
  externalId?: string; // For ECS task ARN or similar
}

const SimulationStepSchema = new Schema<ISimulationStep>({
  key: { type: String, required: true },
  label: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "running", "done", "error"],
    default: "pending",
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
});

const SimulationSessionSchema = new Schema<ISimulationSession>(
  {
    status: {
      type: String,
      enum: [
        "pending",
        "starting",
        "provisioning",
        "configuring",
        "initializing",
        "checking",
        "ready",
        "error",
        "terminated",
        "timed_out",
      ],
      default: "pending",
    },
    steps: [SimulationStepSchema],
    progress: { type: Number, default: 0 },
    config: {
      region: { type: String, required: true },
      services: [{ type: String }],
      userId: { type: String, required: true },
    },
    orchestrator: { type: String, enum: ["local", "ecs"], required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    startedAt: { type: Date },
    readyAt: { type: Date },
    terminatedAt: { type: Date },
    errorMessage: { type: String },
    externalId: { type: String },
  },
  {
    timestamps: true,
  },
);

// Index for TTL cleanup
SimulationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SimulationSessionModel = mongoose.model<ISimulationSession>(
  "SimulationSession",
  SimulationSessionSchema,
);

// Export types for compatibility
export type SimulationStep = ISimulationStep;
export type SimulationConfig = ISimulationConfig;
export type SimulationSession = ISimulationSession;
