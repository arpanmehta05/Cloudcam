// Cost Rules Configuration — All cost optimization rules centralized here
// Each rule maps to an AWS service and provides static cost optimization recommendations

export interface CostRule {
  condition: string;
  savings: number; // 0-1, percentage savings
  reason: string;
}

export const COST_RULES: Record<string, CostRule[]> = {
  // ═══════════════════════════════════════════════════════════════════
  // COMPUTE
  // ═══════════════════════════════════════════════════════════════════
  ec2: [
    {
      condition: "cpu_avg < 20",
      savings: 0.5,
      reason: "Underutilized — consider right-sizing",
    },
    {
      condition: "cpu_avg > 80",
      savings: 0,
      reason: "Over-utilized — consider upgrading",
    },
    {
      condition: "status_check > 0",
      savings: 0,
      reason: "Health check failing — investigate",
    },
  ],

  ebs: [
    {
      condition: "read_ops + write_ops == 0",
      savings: 1.0,
      reason: "Unused volume — consider deleting",
    },
  ],

  eks: [
    {
      condition: "pod_cpu_avg < 10",
      savings: 0.3,
      reason: "Low pod CPU — consider scaling down",
    },
  ],

  ecs: [
    {
      condition: "cpu_avg < 10",
      savings: 0.4,
      reason: "Low CPU — consider smaller task definition",
    },
    {
      condition: "running_tasks < desired_tasks",
      savings: 0,
      reason: "Tasks failing to start — check logs",
    },
  ],

  autoscaling: [],

  // ═══════════════════════════════════════════════════════════════════
  // SERVERLESS
  // ═══════════════════════════════════════════════════════════════════
  lambda: [
    {
      condition: "errors / invocations > 0.05",
      savings: 0,
      reason: "High error rate (>5%)",
    },
    {
      condition: "duration_avg > 3000",
      savings: 0.2,
      reason: "Long duration — optimize code",
    },
  ],

  amplify: [
    {
      condition: "5xx_errors > requests * 0.01",
      savings: 0,
      reason: "High 5xx error rate",
    },
  ],

  apigateway: [
    {
      condition: "latency_avg > 1000",
      savings: 0,
      reason: "High latency — optimize backend",
    },
  ],

  stepfunctions: [],

  // ═══════════════════════════════════════════════════════════════════
  // DATABASE
  // ═══════════════════════════════════════════════════════════════════
  rds: [
    {
      condition: "connections_avg == 0",
      savings: 1.0,
      reason: "No connections — consider stopping",
    },
    {
      condition: "cpu_avg < 10",
      savings: 0.4,
      reason: "Underutilized — consider smaller instance",
    },
  ],

  dynamodb: [
    {
      condition: "throttled_requests > 0",
      savings: 0,
      reason: "Throttling detected — increase capacity",
    },
  ],

  elasticache: [],

  redshift: [
    {
      condition: "connections_avg == 0",
      savings: 1.0,
      reason: "No connections — consider pausing",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════
  s3: [
    {
      condition: "size > 100GB",
      savings: 0.7,
      reason: "Large bucket — consider Glacier for archival",
    },
  ],

  efs: [],

  // ═══════════════════════════════════════════════════════════════════
  // NETWORKING & CDN
  // ═══════════════════════════════════════════════════════════════════
  alb: [],

  cloudfront: [
    {
      condition: "error_rate > 5",
      savings: 0,
      reason: "High error rate — check origin",
    },
  ],

  azure_cdn: [
    {
      condition: "error_rate > 5",
      savings: 0,
      reason: "High error rate — check origin",
    },
  ],

  gcp_cdn: [
    {
      condition: "error_rate > 5",
      savings: 0,
      reason: "High error rate — check origin",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════════════════════
  waf: [],

  // ═══════════════════════════════════════════════════════════════════
  // STREAMING
  // ═══════════════════════════════════════════════════════════════════
  kinesis: [],

  // ═══════════════════════════════════════════════════════════════════
  // MESSAGING
  // ═══════════════════════════════════════════════════════════════════
  sqs: [],
  sns: [],
  eventbridge: [],

  // ═══════════════════════════════════════════════════════════════════
  // BILLING & AGGREGATED
  // ═══════════════════════════════════════════════════════════════════
  billing: [],
  cost: [],
  networking: [],
  security: [],
  alerts: [],
};

/**
 * Get cost rules for a specific service
 */
export function getCostRulesForService(serviceId: string): CostRule[] {
  return COST_RULES[serviceId] || [];
}

/**
 * Get all cost rules
 */
export function getAllCostRules(): Record<string, CostRule[]> {
  return COST_RULES;
}
