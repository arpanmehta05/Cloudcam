import type { CloudWatchMetricDefinition } from "@/lib/services/registry";

export interface AlarmResource {
  label: string;
  value: string;
}

export interface AlarmServiceInfo {
  key: string;
  label: string;
  namespace: string;
  dimensionKey: string;
  hasResources: boolean;
  resourceCount: number;
  metrics: CloudWatchMetricDefinition[];
}

export type AlarmForm = {
  name: string;
  region: string;
  service: string;
  namespace: string;
  metric: string;
  threshold: number;
  comparison: string;
  period: number;
  evaluationPeriods: number;
  statistic: string;
  dimensionName: string;
  dimensionValue: string;
  snsTopicArn: string;
};

export interface CustomAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  region: string;
  alarm?: any | null;
  initialMetric?: {
    name: string;
    namespace: string;
    metricName: string;
  } | null;
}
