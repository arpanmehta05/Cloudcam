// Azure Module — Public Interface
// Only exports what external callers need. Internal files stay private.
export { azureRouter } from "./azure.router";

// Public service interfaces (used by cloud aggregation module)
export { getResources } from "./services/resources.service";
export { getBillingData } from "./services/billing.service";
export { getAzureServiceMetrics } from "./services/metrics.service";
export { getInsights } from "./services/insights.service";
export { getSecurityData } from "./services/security.service";
export { saveAzureConnectionService, validateAzureCredentials, validateAzureCredentialsDetailed, validateAzureDeploymentPermissions, discoverAzureVnetAndSubnet } from "./services/save-connection.service";
export { generateAzureSetup } from "./services/setup.service";

// Public type exports
export type { AzureCredentialsInput, AzureValidationResult } from "./services/save-connection.service";
export type { ProvisionResult, AzureAlarmTemplate } from "./services/default-alarms.service";
