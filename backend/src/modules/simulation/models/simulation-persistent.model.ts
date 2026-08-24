import mongoose, { Schema, Document } from "mongoose";

export interface ISimulationDeployment {
  deploymentId: string;
  label: string;
  status: "active" | "destroyed" | "failed";
  provider?: "aws" | "azure" | "gcp";
  region: string;
  hcl: string;
  state?: any;
  outputs?: Record<string, any>;
  createdAt: Date;
  destroyedAt?: Date;
}

export interface IPersistentSimulation extends Document {
  userId: string;
  name: string;
  status: "draft" | "active" | "destroyed" | "failed";
  provider?: "aws" | "azure" | "gcp";
  region: string;
  graph: {
    nodes: any[];
    edges: any[];
  };
  terraform?: {
    hcl?: string;
    state?: any;
    outputs?: Record<string, any>;
  };
  deployments?: ISimulationDeployment[];
  createdAt: Date;
  updatedAt: Date;
}

const SimulationDeploymentSchema = new Schema<ISimulationDeployment>(
  {
    deploymentId: { type: String, required: true },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "destroyed", "failed"],
      default: "active",
    },
    provider: { type: String, enum: ["aws", "azure", "gcp"] },
    region: { type: String, required: true },
    hcl: { type: String, required: true },
    state: { type: Schema.Types.Mixed },
    outputs: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    destroyedAt: { type: Date },
  },
  { _id: false },
);

const PersistentSimulationSchema = new Schema<IPersistentSimulation>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "destroyed", "failed"],
      default: "draft",
    },
    provider: { type: String, enum: ["aws", "azure", "gcp"] },
    region: { type: String, required: true },
    graph: {
      type: Schema.Types.Mixed,
      default: { nodes: [], edges: [] },
    },
    terraform: {
      hcl: { type: String },
      state: { type: Schema.Types.Mixed },
      outputs: { type: Schema.Types.Mixed },
    },
    deployments: [SimulationDeploymentSchema],
  },
  {
    timestamps: true,
  },
);

export const PersistentSimulationModel = mongoose.model<IPersistentSimulation>(
  "PersistentSimulation",
  PersistentSimulationSchema,
);
