// Backward-compatible re-export — original consumers can still import from this path
// Canonical location is now: backend/src/modules/azure/controllers/index.controller.ts
export {
  azureSetupPost,
  azureSaveConnectionPost,
  azureBillingGet,
  azureInsightsGet,
  azureLogsGet,
  azureMetricsGet,
  azureResourcesGet,
  azureSecurityGet,
  azureAlarmsGet,
  azureAlarmsPost,
  azureAlarmDelete,
  azureAlarmTogglePatch,
  azureDefaultAlarmsGet,
  azureDefaultAlarmsPost,
  azureAlarmMetadataServicesGet,
  azureAlarmMetadataResourcesGet,
  azureAlarmMetadataActionGroupsGet,
} from "../../modules/azure/controllers/index.controller";
