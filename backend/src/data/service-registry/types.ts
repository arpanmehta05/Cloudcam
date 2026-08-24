export interface CloudWatchMetricDefinition {
  /** Human-readable metric name (e.g., "cpu") */
  name: string;
  /** CloudWatch namespace (e.g., "AWS/EC2") */
  namespace: string;
  /** CloudWatch metric name (e.g., "CPUUtilization") */
  metricName: string;
  /** Statistic: Average, Sum, Maximum, Minimum, SampleCount */
  stat: string;
  /** Display unit (e.g., "%", "bytes", "ms", "count", "USD") */
  unit: string;
  /** CloudWatch dimension names used to identify resources (e.g., ["InstanceId"]) */
  dimensionNames: string[];
  /** Default period in seconds */
  period: number;
}

export interface CostRule {
  condition: string;
  savings: number;
  reason: string;
}

export type ServiceCategory =
  | "compute"
  | "serverless"
  | "database"
  | "storage"
  | "networking"
  | "security"
  | "cost"
  | "streaming"
  | "cicd"
  | "iot"
  | "messaging";

export interface ServiceConfig {
  displayName: string;
  category: ServiceCategory;
  /** CloudWatch metrics to fetch for dashboards and chatbot */
  metrics: CloudWatchMetricDefinition[];
  /** Cost optimization rules */
  costRules: CostRule[];
  /** CloudWatch Logs log group pattern (null if not applicable) */
  logGroup: string | null;
  /** Icon identifier for the frontend sidebar */
  icon: string;
}
