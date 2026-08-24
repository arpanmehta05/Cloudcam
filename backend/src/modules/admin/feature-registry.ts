export const FEATURE_KEYS = {
  coreMonitoring: "core_monitoring",
  costExplorer: "cost_explorer",
  aiObservability: "ai_observability",
  watchdog: "watchdog",
  vpsLogs: "vps_logs",
  simulations: "simulations",
  dpdpCompliance: "dpdp_compliance",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  group: "monitoring" | "cost" | "ai" | "security" | "automation";
  description: string;
  lockedDescription: string;
}

export interface PlanRuleDefinition {
  key: "free" | "pro" | "scale";
  name: string;
  price: number;
  isPublic: boolean;
  limits: {
    workspaces: number | null;
    cloudConnections: number | null;
    retentionDays: number | null;
    seats: number | null;
  };
  features: Partial<Record<FeatureKey, boolean>>;
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: FEATURE_KEYS.coreMonitoring,
    name: "Core Monitoring",
    group: "monitoring",
    description: "Baseline infrastructure health, inventory, and resource visibility.",
    lockedDescription: "Core Monitoring is included with every active CloudWatcher plan.",
  },
  {
    key: FEATURE_KEYS.costExplorer,
    name: "Cost Explorer",
    group: "cost",
    description: "Cloud cost breakdowns, savings insights, and optimization context.",
    lockedDescription: "Upgrade to Pro to unlock spend analysis and cost optimization workflows.",
  },
  {
    key: FEATURE_KEYS.aiObservability,
    name: "AI Observability",
    group: "ai",
    description: "LLM traces, token spend, evals, alerts, and request-level debugging.",
    lockedDescription: "Upgrade to Pro to inspect AI traces, model spend, evals, and quality signals.",
  },
  {
    key: FEATURE_KEYS.watchdog,
    name: "Watchdog",
    group: "monitoring",
    description: "Anomaly detection, incident signals, and operational health checks.",
    lockedDescription: "Upgrade to Pro to unlock Watchdog anomaly detection and incident signals.",
  },
  {
    key: FEATURE_KEYS.vpsLogs,
    name: "VPS Logs",
    group: "monitoring",
    description: "Log forwarding, agent management, alarms, and alert policies for VPS fleets.",
    lockedDescription: "Upgrade to Scale to centralize VPS logs, alarms, and alert policies.",
  },
  {
    key: FEATURE_KEYS.simulations,
    name: "Simulations",
    group: "automation",
    description: "What-if infrastructure modeling, Terraform preview, and simulated deployments.",
    lockedDescription: "Upgrade to Scale to run infrastructure simulations and deployment previews.",
  },
  {
    key: FEATURE_KEYS.dpdpCompliance,
    name: "DPDP Compliance",
    group: "security",
    description: "Data protection compliance tooling, evidence, and governance workflows.",
    lockedDescription: "Upgrade to Scale to unlock DPDP compliance guardrails and reports.",
  },
];

export const PLAN_RULES: PlanRuleDefinition[] = [
  {
    key: "free",
    name: "Free",
    price: 0,
    isPublic: true,
    limits: { workspaces: 1, cloudConnections: 1, retentionDays: 7, seats: 1 },
    features: {
      [FEATURE_KEYS.coreMonitoring]: true,
    },
  },
  {
    key: "pro",
    name: "Pro",
    price: 49,
    isPublic: true,
    limits: { workspaces: 3, cloudConnections: 3, retentionDays: 30, seats: 10 },
    features: {
      [FEATURE_KEYS.coreMonitoring]: true,
      [FEATURE_KEYS.costExplorer]: true,
      [FEATURE_KEYS.aiObservability]: true,
      [FEATURE_KEYS.watchdog]: true,
    },
  },
  {
    key: "scale",
    name: "Scale",
    price: 199,
    isPublic: true,
    limits: { workspaces: 10, cloudConnections: 10, retentionDays: 90, seats: 50 },
    features: {
      [FEATURE_KEYS.coreMonitoring]: true,
      [FEATURE_KEYS.costExplorer]: true,
      [FEATURE_KEYS.aiObservability]: true,
      [FEATURE_KEYS.watchdog]: true,
      [FEATURE_KEYS.vpsLogs]: true,
      [FEATURE_KEYS.simulations]: true,
      [FEATURE_KEYS.dpdpCompliance]: true,
    },
  },
];

export function isKnownFeatureKey(key: string): key is FeatureKey {
  return FEATURE_DEFINITIONS.some((feature) => feature.key === key);
}

export function featureDefinitionFor(key: string): FeatureDefinition | null {
  return FEATURE_DEFINITIONS.find((feature) => feature.key === key) ?? null;
}

export function requiredPlanForFeature(key: string): string | null {
  const rule = PLAN_RULES.find((plan) => plan.features[key as FeatureKey] === true);
  return rule?.key ?? null;
}
