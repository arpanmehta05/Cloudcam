// Intent Classifier - Gemini Stage 1
// Classifies user intent and determines what data sources to query

import { z } from "zod";
import type { ParsedIntent } from "../models/chat.model";

const INTENT_VALUES = [
  "billing_status",
  "cost_optimization",
  "resource_health",
  "debugging",
  "anomaly_detection",
  "comparison",
  "infrastructure_action",
  "security_audit",
  "performance_tuning",
  "architecture_review",
  "compliance_check",
  "capacity_planning",
  "product_help",
  "general",
] as const;

const TIME_RANGE_VALUES = ["1h", "6h", "24h", "7d", "30d"] as const;

const IntentSchema = z.enum(INTENT_VALUES);
const TimeRangeSchema = z.enum(TIME_RANGE_VALUES);

const ClassifierOutputSchema = z.object({
  intent: IntentSchema,
  services: z.array(z.string().min(1)).default(["billing", "ec2"]),
  dataSources: z
    .object({
      metrics: z.boolean().default(true),
      logs: z.boolean().default(false),
      costExplorer: z.boolean().default(false),
    })
    .default({ metrics: true, logs: false, costExplorer: false }),
  timeRange: TimeRangeSchema.default("24h"),
  comparison: z
    .object({
      enabled: z.boolean(),
      compareTo: z.string().optional(),
    })
    .optional(),
  isFollowUp: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.55),
  clarificationQuestion: z.string().optional(),
  extractedEntities: z
    .object({
      instanceIds: z.array(z.string()).default([]),
      functionNames: z.array(z.string()).default([]),
      bucketNames: z.array(z.string()).default([]),
      dbIdentifiers: z.array(z.string()).default([]),
      clusterNames: z.array(z.string()).default([]),
      specificTime: z.string().nullable().optional(),
    })
    .optional(),
});

export const CLASSIFIER_SYSTEM_PROMPT = `
You are an intent classifier for Rabbittize, an AWS monitoring, cost optimization, and infrastructure automation system.
Your job is to understand what the user wants and determine what data to fetch.

AVAILABLE SERVICES:
─── Compute ───
- ec2: EC2 instances (CPU, network, disk, status checks)
- ebs: EBS volumes (read/write ops, throughput, queue length)
- eks: EKS clusters (pod CPU/memory, node count, network)
- ecs: ECS services (CPU, memory, running/desired tasks, network)
- autoscaling: Auto Scaling Groups (in-service, desired, pending, terminating)

─── Serverless ───
- lambda: Lambda functions (invocations, errors, duration, throttles, concurrency)
- amplify: Amplify hosting (requests, bytes, errors, latency)
- apigateway: API Gateway (requests, latency, 4xx/5xx errors, integration latency)
- stepfunctions: Step Functions (started/succeeded/failed executions, duration)
- eventbridge: EventBridge (invocations, matched events, failures)

─── Database ───
- rds: RDS databases (CPU, connections, storage, IOPS, latency, memory)
- dynamodb: DynamoDB tables (read/write capacity, throttles, latency)
- elasticache: ElastiCache (CPU, memory, hits/misses, connections, evictions)
- redshift: Redshift clusters (CPU, disk, connections, IOPS)

─── Storage ───
- s3: S3 buckets (size, object count)
- efs: Elastic File System (IO bytes, connections, throughput)

─── Networking & CDN ───
- alb: Application Load Balancer (requests, response time, healthy/unhealthy hosts, 5xx, connections)
- cloudfront: CloudFront CDN (requests, error rate, bytes transferred)
- networking: Aggregated networking view (ALB + CloudFront combined)

─── Security ───
- waf: WAF firewall (blocked/allowed requests)
- security: Aggregated security (GuardDuty threats, SecurityHub findings, IAM audit)

─── Messaging & Streaming ───
- sqs: SQS queues (visible, sent, received, deleted, age)
- sns: SNS topics (published, delivered, failed)
- kinesis: Kinesis Data Streams (records, bytes, iterator age, throughput exceeded)

─── Cost ───
- billing: AWS billing (month-to-date, forecast, per-service breakdown)
- cost: Alias for billing

Product Areas:
- docs: CloudWatcher documentation pages at /docs, including getting started, AWS setup, billing metrics, dashboards, Watchdog, alerts, AI Observability, simulations, live infrastructure, recommendations, actions, troubleshooting, and FAQ
- simulation: CloudWatcher simulation builder, Terraform preview, deployment, history, destroy, PEM download
- live_infrastructure: Live Infrastructure canvases for existing AWS inventory and supported live actions
- ai_observability: AI Observability telemetry, traces, events, models, cost, errors, alerts, budgets, routing, prompts, Bedrock metrics
- product: General CloudWatcher product usage, setup, navigation, troubleshooting, and docs

INTENT TYPES:
- billing_status: User wants to know current spending/costs/charges/budget
- cost_optimization: User wants to save money, reduce costs, find waste, right-size resources
- resource_health: User wants to check if systems are working, health status, uptime
- debugging: User wants to investigate an error/failure/crash/timeout/exception
- anomaly_detection: User wants to find unusual patterns, spikes, unexpected behavior
- comparison: User wants to compare time periods, before/after analysis
- infrastructure_action: User wants to modify, stop, start, resize, delete, terminate, optimize, or apply lifecycle/policies to resources
- security_audit: User wants to review security posture, open ports, encryption, IAM, GuardDuty, WAF
- performance_tuning: User wants to improve speed, reduce latency, optimize throughput, fix cold starts
- architecture_review: User wants a high-level review of their setup, Well-Architected assessment
- compliance_check: User wants to check for standards, best practices, CIS benchmarks, encryption, tagging
- capacity_planning: User wants to plan for growth, forecast resource needs, scaling readiness
- product_help: User asks how to use CloudWatcher/Rabbittize features, where to find something in the product, setup instructions, simulation help, AI Observability help, API endpoints, or troubleshooting product pages
- general: General question about their infrastructure that doesn't fit above categories

DATA SOURCE RULES:
- logs: true ONLY if query mentions: error, fail, crash, issue, problem, debug, "why did X fail", investigate, exception, timeout, 5xx, crash, stack trace, log
- logs: false for: billing, cost, optimize, save money, health check, status, utilization, stop, start, resize, terminate, security, performance
- costExplorer: true if query mentions: bill, cost, spend, charges, expensive, save money, budget, forecast, waste, idle, unused, optimization, savings, right-size

SERVICE DETECTION (be smart about implicit references):
- "database" / "db" → rds, dynamodb
- "cache" / "caching" → elasticache
- "queue" / "messaging" → sqs, sns
- "api" / "endpoint" → apigateway, alb
- "cdn" / "content delivery" → cloudfront
- "container" / "docker" → ecs, eks
- "serverless" → lambda, stepfunctions, eventbridge
- "storage" → s3, ebs, efs
- "firewall" / "waf" → waf
- "load balancer" / "lb" → alb
- "network" → networking, alb, cloudfront
- "everything" / "all" / "overview" → ec2, lambda, rds, s3, billing
- If action-related: also include relevant service for target discovery
- Product feature references:
  - "docs" / "documentation" / "/docs" / "docs page" / "faq page" -> docs, product
  - "simulation" / "terraform preview" / "deploy simulation" / "simulation history" -> simulation
  - "live infrastructure" / "live canvas" -> live_infrastructure
  - "ai observability" / "trace explorer" / "ingest key" / "llm" / "model cost" / "prompt insights" / "routing recommendations" / "bedrock console" -> ai_observability
  - "how do I" / "where is" / "what is" about product features -> product

TIME RANGE INTERPRETATION:
- "today" / "now" / "current" → "24h"
- "this week" / "past week" → "7d"
- "this month" / "month to date" → "30d"
- "yesterday" → "24h" (offset)
- "last hour" / "recently" → "1h"
- "last 6 hours" → "6h"
- specific time like "at 2pm" → "1h"
- If no time mentioned → "24h"

OUTPUT JSON ONLY. No other text.
`;

export const CLASSIFIER_USER_PROMPT = (
  message: string,
  history: string,
): string => `
CONVERSATION HISTORY:
${history}

CURRENT USER MESSAGE:
"${message}"

Analyze and return JSON:
{
  "intent": "billing_status|cost_optimization|resource_health|debugging|anomaly_detection|comparison|infrastructure_action|security_audit|performance_tuning|architecture_review|compliance_check|capacity_planning|product_help|general",
  "services": ["service1", "service2"],
  "dataSources": {
    "metrics": true,
    "logs": boolean,
    "costExplorer": boolean
  },
  "timeRange": "1h|6h|24h|7d|30d",
  "comparison": {
    "enabled": boolean,
    "compareTo": "previous_period"
  },
  "isFollowUp": boolean,
    "confidence": 0.0,
    "clarificationQuestion": "optional short question if confidence < 0.5",
  "extractedEntities": {
    "instanceIds": [],
    "functionNames": [],
    "bucketNames": [],
    "dbIdentifiers": [],
    "clusterNames": [],
    "specificTime": null
  }
}
`;

// Parse classifier response
export function parseClassifierResponse(
  responseText: string,
  message: string = "",
): ParsedIntent {
  const heuristic = buildHeuristicIntent(message);
  const heuristicConfidence = heuristic.confidence ?? 0;
  const jsonText = extractJsonObject(responseText);
  if (!jsonText) {
    return heuristicConfidence >= 0.45 ? heuristic : getDefaultIntent();
  }

  const parsedRaw = parseJsonWithRepairs(jsonText);
  if (!parsedRaw) {
    return heuristicConfidence >= 0.45 ? heuristic : getDefaultIntent();
  }

  const normalized = normalizeClassifierOutput(parsedRaw, message, heuristic);
  const parsed = ClassifierOutputSchema.safeParse(normalized);
  if (!parsed.success) {
    return heuristicConfidence >= 0.45 ? heuristic : getDefaultIntent();
  }

  const services = [
    ...new Set(
      parsed.data.services.map((service) => normalizeService(service)),
    ),
  ].slice(0, 8);
  const candidate: ParsedIntent = {
    intent: parsed.data.intent,
    services: services.length > 0 ? services : ["billing", "ec2"],
    dataSources: parsed.data.dataSources,
    timeRange: parsed.data.timeRange,
    comparison: parsed.data.comparison,
    isFollowUp: parsed.data.isFollowUp,
    extractedEntities: parsed.data.extractedEntities
      ? {
          ...parsed.data.extractedEntities,
          specificTime: parsed.data.extractedEntities.specificTime || undefined,
        }
      : undefined,
    confidence: parsed.data.confidence,
    clarificationQuestion: parsed.data.clarificationQuestion,
  };

  if ((candidate.confidence ?? 0) < 0.45 && heuristicConfidence >= 0.55) {
    return heuristic;
  }

  if (
    candidate.intent === "general" &&
    heuristic.intent !== "general" &&
    heuristicConfidence >= 0.55
  ) {
    return heuristic;
  }

  return candidate;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function parseJsonWithRepairs(jsonText: string): unknown | null {
  try {
    return JSON.parse(jsonText);
  } catch {
    try {
      const repaired = jsonText
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/[\u201C\u201D]/g, '"');
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function normalizeClassifierOutput(
  rawValue: unknown,
  message: string,
  heuristic: ParsedIntent,
) {
  const raw =
    rawValue && typeof rawValue === "object"
      ? (rawValue as Record<string, unknown>)
      : {};
  const intent = normalizeIntent(raw.intent) ?? heuristic.intent;
  const inferredServices = inferServices(message, intent);
  const rawServices = normalizeServiceList(raw.services, []);
  const services =
    intent === "product_help"
      ? [...new Set([...rawServices, ...inferredServices])].slice(0, 8)
      : rawServices.length > 0
        ? rawServices.slice(0, 8)
        : inferredServices;
  const inferredDataSources = inferDataSources(message, intent);
  const dataSourceRaw =
    raw.dataSources && typeof raw.dataSources === "object"
      ? (raw.dataSources as Record<string, unknown>)
      : {};

  const confidenceFallback =
    heuristic.intent === intent && (heuristic.confidence ?? 0) >= 0.55
      ? (heuristic.confidence ?? 0.55)
      : 0.5;
  const confidence = clampNumber(raw.confidence, confidenceFallback, 0, 1);

  return {
    intent,
    services,
    dataSources: {
      metrics: toBoolean(dataSourceRaw.metrics, inferredDataSources.metrics),
      logs: toBoolean(dataSourceRaw.logs, inferredDataSources.logs),
      costExplorer: toBoolean(
        dataSourceRaw.costExplorer,
        inferredDataSources.costExplorer,
      ),
    },
    timeRange: normalizeTimeRange(raw.timeRange),
    comparison: normalizeComparison(raw.comparison),
    isFollowUp: toBoolean(raw.isFollowUp, false),
    confidence,
    clarificationQuestion: toOptionalString(raw.clarificationQuestion),
    extractedEntities: normalizeEntities(raw.extractedEntities),
  };
}

function normalizeIntent(value: unknown): ParsedIntent["intent"] | undefined {
  const normalized =
    typeof value === "string"
      ? value.trim().toLowerCase().replace(/\s+/g, "_")
      : "";
  if (INTENT_VALUES.includes(normalized as (typeof INTENT_VALUES)[number]))
    return normalized;

  if (!normalized) return undefined;
  if (
    normalized.includes("billing") ||
    normalized.includes("spend") ||
    normalized.includes("cost_status")
  )
    return "billing_status";
  if (
    normalized.includes("optimiz") ||
    normalized.includes("saving") ||
    normalized.includes("rightsiz")
  )
    return "cost_optimization";
  if (normalized.includes("health") || normalized.includes("uptime"))
    return "resource_health";
  if (
    normalized.includes("debug") ||
    normalized.includes("error") ||
    normalized.includes("incident")
  )
    return "debugging";
  if (
    normalized.includes("anomaly") ||
    normalized.includes("spike") ||
    normalized.includes("outlier")
  )
    return "anomaly_detection";
  if (normalized.includes("compare")) return "comparison";
  if (
    normalized.includes("action") ||
    normalized.includes("operation") ||
    normalized.includes("remediation")
  )
    return "infrastructure_action";
  if (normalized.includes("security")) return "security_audit";
  if (normalized.includes("performance") || normalized.includes("latency"))
    return "performance_tuning";
  if (
    normalized.includes("architecture") ||
    normalized.includes("well_architected")
  )
    return "architecture_review";
  if (normalized.includes("compliance") || normalized.includes("policy"))
    return "compliance_check";
  if (normalized.includes("capacity") || normalized.includes("forecast"))
    return "capacity_planning";
  if (
    normalized.includes("product") ||
    normalized.includes("help") ||
    normalized.includes("simulation") ||
    normalized.includes("observability")
  )
    return "product_help";

  return undefined;
}

function normalizeServiceList(value: unknown, fallback: string[]): string[] {
  const fromArray = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/g)
      : [];

  const services = [
    ...new Set(
      fromArray
        .map((item) => normalizeService(String(item || "")))
        .filter((item) => item.length > 0),
    ),
  ];

  return services.length > 0 ? services.slice(0, 8) : fallback;
}

function normalizeService(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized === "cost") return "billing";
  return normalized;
}

function normalizeTimeRange(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (TIME_RANGE_VALUES.includes(raw as (typeof TIME_RANGE_VALUES)[number]))
    return raw;
  if (raw.includes("month") || raw.includes("30")) return "30d";
  if (raw.includes("week") || raw.includes("7")) return "7d";
  if (raw.includes("6")) return "6h";
  if (raw.includes("hour") || raw.includes("1h")) return "1h";
  return "24h";
}

function normalizeComparison(
  value: unknown,
): { enabled: boolean; compareTo?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const enabled = toBoolean(raw.enabled, false);
  const compareTo = toOptionalString(raw.compareTo);
  if (!enabled && !compareTo) return undefined;
  return { enabled, compareTo };
}

function normalizeEntities(value: unknown):
  | {
      instanceIds: string[];
      functionNames: string[];
      bucketNames: string[];
      dbIdentifiers: string[];
      clusterNames: string[];
      specificTime?: string;
    }
  | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const specificTime = toOptionalString(raw.specificTime) ?? undefined;

  return {
    instanceIds: normalizeStringArray(raw.instanceIds),
    functionNames: normalizeStringArray(raw.functionNames),
    bucketNames: normalizeStringArray(raw.bucketNames),
    dbIdentifiers: normalizeStringArray(raw.dbIdentifiers),
    clusterNames: normalizeStringArray(raw.clusterNames),
    specificTime,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0),
      ),
    ].slice(0, 20);
  }
  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(/[,\n]/g)
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    ].slice(0, 20);
  }
  return [];
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function buildHeuristicIntent(message: string): ParsedIntent {
  const lower = message.toLowerCase();
  const hasBilling = /(billing|bill|cost|spend|charges|budget|forecast)/.test(
    lower,
  );
  const hasOptimization =
    /(optimi[sz](e|ation)|save|savings|reduce cost|rightsiz|idle|waste|opportunit)/.test(
      lower,
    );
  const hasDebug =
    /(error|fail|failed|crash|exception|timeout|5xx|debug|incident|issue)/.test(
      lower,
    );
  const hasAction =
    /(stop|start|terminate|delete|resize|scale|reboot|apply|enable|disable|execute)/.test(
      lower,
    );
  const hasSecurity =
    /(security|vulnerab|iam|guardduty|waf|encryption|compliance)/.test(lower);
  const hasPerformance =
    /(latency|slow|throughput|performance|cold start)/.test(lower);
  const hasHealth = /(health|status|uptime|availability|are .* running)/.test(
    lower,
  );
  const hasCapacity =
    /(capacity|headroom|forecast usage|scaling readiness)/.test(lower);
  const hasProductHelp =
    /(cloudwatcher|rabbittize|rabbittwatch|docs|documentation|\/docs|faq|simulation|simulations|terraform preview|live infrastructure|live canvas|ai observability|trace explorer|ingest key|prompt insights|routing recommendations|bedrock console|how do i|where (is|can)|what is|help|setup)/.test(
      lower,
    );

  let intent: ParsedIntent["intent"] = "general";
  let confidence = 0.35;

  if (hasProductHelp) {
    intent = "product_help";
    confidence = 0.82;
  } else if (hasOptimization) {
    intent = "cost_optimization";
    confidence = 0.8;
  } else if (hasBilling) {
    intent = "billing_status";
    confidence = 0.82;
  } else if (hasAction) {
    intent = "infrastructure_action";
    confidence = 0.78;
  } else if (hasDebug) {
    intent = "debugging";
    confidence = 0.76;
  } else if (hasSecurity) {
    intent = "security_audit";
    confidence = 0.74;
  } else if (hasPerformance) {
    intent = "performance_tuning";
    confidence = 0.72;
  } else if (hasHealth) {
    intent = "resource_health";
    confidence = 0.7;
  } else if (hasCapacity) {
    intent = "capacity_planning";
    confidence = 0.68;
  }

  const services = inferServices(message, intent);
  const dataSources = inferDataSources(message, intent);

  return {
    intent,
    services,
    dataSources,
    timeRange: normalizeTimeRange(message),
    isFollowUp: false,
    confidence,
    clarificationQuestion:
      confidence < 0.45
        ? "Do you want billing, health, optimization, or an infrastructure action?"
        : undefined,
  };
}

function inferServices(
  message: string,
  intent: ParsedIntent["intent"],
): string[] {
  const lower = message.toLowerCase();
  const services = new Set<string>();

  if (
    /(billing|bill|cost|spend|charges|budget|forecast)/.test(lower) ||
    intent === "billing_status" ||
    intent === "cost_optimization"
  ) {
    services.add("billing");
  }
  if (/(ec2|instance)/.test(lower)) services.add("ec2");
  if (/(lambda|serverless)/.test(lower)) services.add("lambda");
  if (/(rds|database|db)/.test(lower)) services.add("rds");
  if (/(dynamodb)/.test(lower)) services.add("dynamodb");
  if (/(s3|bucket|storage)/.test(lower)) services.add("s3");
  if (/(eks|kubernetes)/.test(lower)) services.add("eks");
  if (/(ecs|container)/.test(lower)) services.add("ecs");
  if (/(api gateway|apigateway|endpoint|api)/.test(lower))
    services.add("apigateway");
  if (/(alb|load balancer)/.test(lower)) services.add("alb");
  if (/(cloudfront|cdn)/.test(lower)) services.add("cloudfront");
  if (/(security|waf|guardduty|iam)/.test(lower)) services.add("security");
  if (/(docs|documentation|\/docs|faq|guide|manual)/.test(lower))
    services.add("docs");
  if (
    /(simulation|simulations|terraform preview|deploy simulation|simulation history|destroy deployment)/.test(
      lower,
    )
  )
    services.add("simulation");
  if (/(live infrastructure|live canvas|sync inventory)/.test(lower))
    services.add("live_infrastructure");
  if (
    /(ai observability|trace explorer|ingest key|llm|model|tokens|prompt insights|routing recommendations|bedrock console|ai trace|ai event)/.test(
      lower,
    )
  )
    services.add("ai_observability");
  if (
    /(cloudwatcher|rabbittize|rabbittwatch|docs|documentation|\/docs|how do i|where is|what is|help|setup)/.test(
      lower,
    ) ||
    intent === "product_help"
  )
    services.add("product");

  if (services.size === 0) {
    if (intent === "product_help") services.add("product");
    if (intent === "billing_status" || intent === "cost_optimization")
      services.add("billing");
    services.add("ec2");
  }

  return [...services].slice(0, 8);
}

function inferDataSources(
  message: string,
  intent: ParsedIntent["intent"],
): {
  metrics: boolean;
  logs: boolean;
  costExplorer: boolean;
} {
  if (intent === "product_help") {
    return {
      metrics: false,
      logs: false,
      costExplorer: false,
    };
  }

  const lower = message.toLowerCase();
  const wantsLogs =
    /(error|fail|crash|issue|problem|debug|exception|timeout|5xx|log|vps|docker|pm2)/.test(
      lower,
    );
  const wantsCost =
    /(bill|billing|cost|spend|charges|budget|forecast|save|savings|optimiz|rightsiz|waste|idle)/.test(
      lower,
    ) ||
    intent === "billing_status" ||
    intent === "cost_optimization";

  return {
    metrics: true,
    logs: wantsLogs,
    costExplorer: wantsCost,
  };
}

function getDefaultIntent(): ParsedIntent {
  return {
    intent: "general",
    services: ["billing", "ec2", "lambda"],
    dataSources: {
      metrics: true,
      logs: false,
      costExplorer: true,
    },
    timeRange: "24h",
    isFollowUp: false,
    confidence: 0.2,
    clarificationQuestion:
      "Do you want billing, health, optimization, or an infrastructure action?",
  };
}
