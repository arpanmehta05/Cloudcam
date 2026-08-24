// Backward-compatible re-export — canonical location: modules/azure/services/save-connection.service.ts
export {
  saveAzureConnectionService,
  validateAzureCredentials,
  validateAzureCredentialsDetailed,
  validateAzureDeploymentPermissions,
  discoverAzureVnetAndSubnet,
} from "../../modules/azure/services/save-connection.service";
export type { AzureCredentialsInput, AzureValidationResult } from "../../modules/azure/services/save-connection.service";
