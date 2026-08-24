import { serviceRegistry } from "@/modules/simulation";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import type { CloudProvider } from "@/lib/regions";
import type { Recommendation } from "./types";

export function inferSimulationServiceId(actionId?: string, resourceId?: string) {
  const actionIdLower = (actionId || "").toLowerCase();
  const targetIdLower = (resourceId || "").toLowerCase();

  if (
    actionIdLower.includes("s3") ||
    targetIdLower.includes("s3") ||
    targetIdLower.includes("bucket")
  )
    return "s3";
  if (actionIdLower.includes("rds") || targetIdLower.includes("rds"))
    return "rds";
  if (actionIdLower.includes("lambda") || targetIdLower.includes("lambda"))
    return "lambda";
  if (actionIdLower.includes("dynamo") || targetIdLower.includes("dynamo"))
    return "dynamodb";
  return "ec2";
}

export function buildSimulationNodesFromActionPlan(
  plan: Recommendation["actionPlan"],
) {
  if (!plan) return [];

  return plan.targets.map((target, idx) => {
    const serviceId = inferSimulationServiceId(
      plan.actionId,
      target.resourceId,
    );
    const definition =
      serviceRegistry.find((service) => service.id === serviceId) ||
      serviceRegistry.find((service) => service.id === "ec2");
    const region = target.region || "us-east-1";
    const targetName =
      target.resourceName ||
      target.resourceId ||
      definition?.label ||
      "Resource";

    return {
      id: `${serviceId}_${Date.now()}_${idx}`,
      type: "service",
      position: { x: 200 + idx * 280, y: 150 },
      data: {
        serviceId,
        label: targetName,
        description: `Recommendation target for ${plan.actionId}`,
        icon: definition?.icon || "Server",
        colorKey: definition?.colorKey || serviceId,
        config: {
          ...(definition?.defaultConfig || {}),
          region,
          ...(serviceId === "ec2" ? { instanceName: targetName } : {}),
        },
        item: {
          id: target.resourceId,
          name: target.resourceName,
          recommendationAction: plan.actionId,
        },
      },
    };
  });
}

export function buildSimulationDraftFromRecommendation(
  rec: Recommendation,
  plan: Recommendation["actionPlan"],
) {
  const serviceNodes = buildSimulationNodesFromActionPlan(plan);
  const noteText = [
    `Recommendation: ${rec.title}`,
    "",
    `Action: ${plan?.actionId || rec.action}`,
    "",
    rec.description,
    rec.savings ? `Estimated savings: ${rec.savings}` : "",
    plan?.reasoning ? `Reasoning: ${plan.reasoning}` : "",
    "Review this plan before running any simulation or deployment step.",
  ]
    .filter(Boolean)
    .join("\n");

  const noteNode = {
    id: `note_${Date.now()}`,
    type: "annotation",
    position: { x: 220, y: 360 },
    width: 340,
    height: 220,
    data: { text: noteText },
  };

  const edges = serviceNodes.slice(0, 1).map((node) => ({
    id: `edge_${node.id}_${noteNode.id}`,
    source: node.id,
    target: noteNode.id,
    animated: true,
    style: { stroke: "var(--primary)", strokeWidth: 2 },
  }));

  return {
    nodes: [...serviceNodes, noteNode],
    edges,
  };
}

export function normalizeImpact(value: unknown): "high" | "medium" | "low" {
  const current = String(value || "medium").toLowerCase();
  if (current === "high") return "high";
  if (current === "low") return "low";
  return "medium";
}

export function estimateSavings(raw: any): string | undefined {
  if (raw?.savings) return String(raw.savings);
  if (Number(raw?.savingsPercentage || 0) > 0)
    return `${Number(raw.savingsPercentage).toFixed(0)}%`;
  return undefined;
}

export function providerActionLabel(
  provider: CloudProvider,
  raw: any,
  category?: string,
) {
  if (raw?.action) return String(raw.action);
  if (provider === "azure")
    return category === "security"
      ? "Review in Azure Advisor and Defender"
      : "Review in Azure Advisor";
  if (provider === "gcp")
    return category === "security"
      ? "Review in Security Command Center"
      : "Review in Google Cloud Recommender";
  return "Review optimization evidence";
}

export function normalizeRecommendation(item: any): Recommendation {
  const provider = (item.provider || "aws") as CloudProvider;
  const raw = item.raw || item;
  const category = String(item.category || raw.category || "optimization");
  const resourceId = item.resourceId || raw.resourceId;
  const baseId = String(item.id || raw.id || item.title || Math.random());

  return {
    id: baseId.startsWith(`${provider}:`) ? baseId : `${provider}:${baseId}`,
    provider,
    title: String(item.title || raw.title || "Provider recommendation"),
    description: String(
      raw.description ||
        item.description ||
        (resourceId
          ? `Resource ${resourceId} has a provider recommendation.`
          : "Provider recommendation is available for review."),
    ),
    impact: normalizeImpact(item.impact || raw.impact),
    category,
    savings: estimateSavings(raw),
    action: providerActionLabel(provider, raw, category),
    resourceId,
    source: raw.source,
    actionPlan: item.actionPlan || raw.actionPlan,
  };
}

export function money(value: number, unit = "USD") {
  const prefix = unit === "USD" || unit === "$" ? "$" : `${unit} `;
  return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
