import {
  SERVICE_DIMENSION_MAP,
  SERVICE_NAMESPACE_MAP,
} from "./alarm-config";
import type { AlarmForm } from "./types";

export const emptyForm = (region: string, provider: string): AlarmForm => ({
  name: "",
  region:
    region === "all"
      ? provider === "azure"
        ? "eastus"
        : provider === "gcp"
          ? "us-central1"
          : "us-east-1"
      : region,
  service: "",
  namespace: "",
  metric: "",
  threshold: 80,
  comparison: "GreaterThanThreshold",
  period: 300,
  evaluationPeriods: 1,
  statistic: "Average",
  dimensionName: "",
  dimensionValue: "",
  snsTopicArn: "",
});

export function getServiceKeyFromNamespace(ns: string): string {
  for (const [key, namespace] of Object.entries(SERVICE_NAMESPACE_MAP)) {
    if (ns === namespace) return key;
  }
  if (ns.includes("virtualMachines") || ns.includes("compute.googleapis.com")) {
    return "ec2";
  }
  if (ns.includes("databases") || ns.includes("cloudsql.googleapis.com")) {
    return "rds";
  }
  if (ns.includes("storageAccounts") || ns.includes("storage.googleapis.com")) {
    return "s3";
  }
  return "";
}

export function getDimensionKeyForProvider(
  provider: string,
  serviceKey: string,
) {
  return provider === "azure"
    ? "resourceId"
    : SERVICE_DIMENSION_MAP[serviceKey] || "";
}

export function getAlarmModalTitle(isEditing: boolean, provider: string) {
  if (isEditing) {
    return provider === "azure"
      ? "Edit Azure Alert Rule"
      : provider === "gcp"
        ? "Edit GCP Alert Policy"
        : "Edit CloudWatch Alarm";
  }

  return provider === "azure"
    ? "Create Azure Alert Rule"
    : provider === "gcp"
      ? "Create GCP Alert Policy"
      : "Create Custom Alarm";
}
