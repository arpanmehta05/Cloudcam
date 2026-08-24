// GCP Module — Public Interface
export { gcpRouter } from "./gcp.router";

// Public service interfaces (used by cloud aggregation)
export { getResources } from "./services/resources.service";
export { getGcpBillingData } from "./services/billing.service";
export { getGcpServiceMetrics } from "./services/metrics.service";
export { getInsights } from "./services/insights.service";
export { getSecurityData } from "./services/security.service";
export { generateGcpSetup } from "./services/setup.service";

// Types
export type { ProvisionResult, GcpAlarmTemplate } from "./services/default-alarms.service";
