import { ServiceId } from "@rabbittwatch/types";

export interface TfNodeInput {
  id: string;
  serviceId: ServiceId;
  config: Record<string, unknown>;
  label?: string;
}

export interface TfEdgeInput {
  source: string;
  target: string;
}

export interface TfRequest {
  nodes: TfNodeInput[];
  edges: TfEdgeInput[];
  region: string;
  name?: string;
  deploymentId?: string;
  provider?: "aws" | "azure" | "gcp";
  isVmContributor?: boolean;
  existingVnetName?: string;
  existingSubnetName?: string;
  githubToken?: string;
}

export interface TfResource {
  address: string;
  type: string;
  name: string;
  serviceId: string;
}

export interface TfResult {
  terraformJson: any;
  terraformHcl: string;
  resources: TfResource[];
  implicitResources: TfResource[];
}
