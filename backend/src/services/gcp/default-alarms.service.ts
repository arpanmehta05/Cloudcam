// Backward-compatible re-export — canonical: modules/gcp/services/default-alarms.service.ts
export {
  provisionDefaultAlarms,
  previewDefaultAlarms,
  GCP_DEFAULT_ALARM_TEMPLATES,
} from "../../modules/gcp/services/default-alarms.service";
export type { ProvisionResult, GcpAlarmTemplate } from "../../modules/gcp/services/default-alarms.service";
