import { ServiceConfig } from "../service-registry";
import { awsComputeRegistry } from "./aws/compute";
import { awsContainersServerlessRegistry } from "./aws/containers-serverless";
import { awsDatabaseRegistry } from "./aws/database";
import { awsStorageRegistry } from "./aws/storage";
import { awsNetworkingSecurityRegistry } from "./aws/networking-security";
import { awsMessagingCostRegistry } from "./aws/messaging-cost";

export const AWS_SERVICE_REGISTRY: Record<string, ServiceConfig> = {
  ...awsComputeRegistry,
  ...awsContainersServerlessRegistry,
  ...awsDatabaseRegistry,
  ...awsStorageRegistry,
  ...awsNetworkingSecurityRegistry,
  ...awsMessagingCostRegistry,
};
