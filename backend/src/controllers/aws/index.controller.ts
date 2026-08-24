// Backward-compatibility re-exports for AWS index controllers
export { billingGet } from "../../modules/aws/controllers/billing.controller";
export { credentialsGet, credentialsDelete, saveRolePost } from "../../modules/aws/controllers/credentials.controller";
export { insightsGet } from "../../modules/aws/controllers/insights.controller";
export { logsGet } from "../../modules/aws/controllers/logs.controller";
export { metricsGet } from "../../modules/aws/controllers/metrics.controller";
export { resourcesGet } from "../../modules/aws/controllers/resources.controller";
export { securityGet } from "../../modules/aws/controllers/security.controller";
export {
  alarmsGet,
  alarmsPost,
  alarmPut,
  alarmTogglePatch,
  alarmDelete,
  defaultAlarmsPost,
  defaultAlarmsGet,
  alarmMetadataServicesGet,
  alarmMetadataResourcesGet,
  alarmMetadataSnsGet,
} from "../../modules/aws/controllers/alarms.controller";
export { setupPost } from "../../modules/aws/controllers/setup.controller";
