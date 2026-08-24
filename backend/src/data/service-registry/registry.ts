import { AWS_SERVICE_REGISTRY } from "./aws-registry";
import { AZURE_SERVICE_REGISTRY } from "./azure-registry";
import { GCP_SERVICE_REGISTRY } from "./gcp-registry";
import type { ServiceConfig } from "./types";

export const SERVICE_REGISTRY: Record<string, ServiceConfig> = {
  ...AWS_SERVICE_REGISTRY,
  ...AZURE_SERVICE_REGISTRY,
  ...GCP_SERVICE_REGISTRY,
};

export const ALL_SERVICES = Object.keys(SERVICE_REGISTRY);
