import { generateJsonContent, isGeminiConfigured } from "../../../providers/gemini.provider";
import { NormalizedCloudResource } from "../../../providers/cloud/types";
import { logger } from "../../../core/logger";
import { z } from "zod";

const MulticloudInsightSchema = z.object({
  recommendations: z.array(z.object({
    id: z.string(),
    provider: z.enum(["aws", "azure", "gcp"]),
    title: z.string(),
    description: z.string(),
    impact: z.enum(["high", "medium", "low"]),
    category: z.enum(["cost", "performance", "security", "reliability"]),
    savings: z.string(),
    action: z.string(),
    resourceId: z.string().optional()
  })),
  diagnosis: z.array(z.object({
    provider: z.enum(["aws", "azure", "gcp"]),
    title: z.string(),
    status: z.enum(["healthy", "warning", "critical"]),
    details: z.string()
  })),
  optimizations: z.array(z.object({
    id: z.string(),
    provider: z.enum(["aws", "azure", "gcp"]),
    title: z.string(),
    description: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    effort: z.enum(["low", "medium", "high"]),
    savings: z.string(),
    action: z.string()
  }))
});

export async function generateMulticloudAiInsights(
  resources: NormalizedCloudResource[],
  billing: any[],
  security: any[],
  nativeRecommendations: any[]
) {
  if (!isGeminiConfigured()) return null;

  // Format the in-memory aggregated cloud facts into a structured RAG sheet
  const resourcesList = resources.slice(0, 45).map((r, i) => 
    `[RES-${i+1}] Provider: ${r.provider} | Service: ${r.service} | Name: ${r.name} | Region: ${r.region} | Status: ${r.status || "active"}`
  ).join("\n");

  const billingList = billing.map((b) => 
    `- ${b.provider.toUpperCase()} MTD Spend: $${Number(b.mtdSpend || b.currentSpend || 0).toFixed(2)} USD (Unit: ${b.unit || "USD"})`
  ).join("\n");

  const securityList = security.map((s) => 
    `- ${s.provider.toUpperCase()} Security Findings: ${s.findingsCount || 0} | Status: ${s.status || "stable"} | Max Severity: ${s.severity || "low"}`
  ).join("\n");

  const nativeList = nativeRecommendations.slice(0, 30).map((n, i) => 
    `[REC-${i+1}] Provider: ${n.provider} | Category: ${n.category} | Title: ${n.title} | Description: ${n.description} | Impact: ${n.impact} | Savings: ${n.savings || "N/A"}`
  ).join("\n");

  const factSheet = `## CONNECTED CLOUDS BILLING BREAKDOWN
${billingList}

## SECURITY findingS SUMMARY
${securityList}

## RESOURCE INVENTORY IN CLOUD ESTATE (Sample of 45 active resources)
${resourcesList}

## NATIVE CLOUD ADVISOR AND OPTIMIZER INSIGHTS
${nativeList}`;

  const prompt = `You are an elite Multicloud Solutions Architect and FinOps specialist.
Analyze this Multicloud Infrastructure Fact Sheet containing real-time data from the user's connected AWS, Azure, and GCP accounts.

## MULTICLOUD INFRASTRUCTURE FACT SHEET
${factSheet}

## YOUR TASK
Perform a comprehensive, cross-cloud analysis. Synthesize native findings into prioritized actionable steps, identify resource-rightsizing opportunities, and flag security vulnerabilities. 
Provide estimated monthly dollar savings for EVERY recommendation.

Return JSON in this EXACT format. The "provider" field must be exactly "aws", "azure", or "gcp". All other fields must use their respective valid enum values:
{
  "recommendations": [
    {
      "id": "ai-rec-1",
      "provider": "aws",
      "title": "short actionable title",
      "description": "detailed explanation with specific resource references",
      "impact": "medium",
      "category": "cost",
      "savings": "$XX/mo",
      "action": "exact step or command",
      "resourceId": "resource-id"
    }
  ],
  "diagnosis": [
    {
      "provider": "aws",
      "title": "finding status",
      "status": "warning",
      "details": "justification details"
    }
  ],
  "optimizations": [
    {
      "id": "ai-opt-1",
      "provider": "aws",
      "title": "title",
      "description": "description",
      "priority": "medium",
      "effort": "low",
      "savings": "$XX/mo",
      "action": "next step"
    }
  ]
}

Return ONLY the JSON block.`;


  try {
    const raw = await generateJsonContent(prompt);
    const sanitized = sanitizeRawAiInsights(raw);
    const parsed = MulticloudInsightSchema.safeParse(sanitized);
    if (parsed.success) return parsed.data;
    logger.error("[Multicloud AI] Schema validation failed: " + JSON.stringify(parsed.error.flatten()));
  } catch (err: any) {
    logger.error("[Multicloud AI] Gemini call failed: " + String(err?.message || err));
  }
  return null;
}

function sanitizeRawAiInsights(raw: any): any {
    if (!raw || typeof raw !== "object") return raw;

    const sanitizeProvider = (val: any) => {
        const str = String(val || "").toLowerCase();
        if (str.includes("aws")) return "aws";
        if (str.includes("azure")) return "azure";
        if (str.includes("gcp") || str.includes("google")) return "gcp";
        return "aws";
    };

    const sanitizeImpact = (val: any) => {
        const str = String(val || "").toLowerCase();
        if (str === "high") return "high";
        if (str === "low") return "low";
        return "medium";
    };

    const sanitizeCategory = (val: any) => {
        const str = String(val || "").toLowerCase();
        if (str.includes("cost") || str.includes("saving") || str.includes("optimization")) return "cost";
        if (str.includes("performance") || str.includes("speed")) return "performance";
        if (str.includes("security") || str.includes("compliance") || str.includes("threat")) return "security";
        return "reliability";
    };

    const sanitizeStatus = (val: any) => {
        const str = String(val || "").toLowerCase();
        if (str === "healthy" || str === "optimal" || str === "ok" || str === "secure") return "healthy";
        if (str === "critical" || str === "error" || str === "danger") return "critical";
        return "warning";
    };

    const sanitizeEffort = (val: any) => {
        const str = String(val || "").toLowerCase();
        if (str === "high") return "high";
        if (str === "medium" || str === "moderate") return "medium";
        return "low";
    };

    const recommendations = Array.isArray(raw.recommendations)
        ? raw.recommendations.map((rec: any) => ({
              ...rec,
              provider: sanitizeProvider(rec.provider),
              impact: sanitizeImpact(rec.impact),
              category: sanitizeCategory(rec.category),
          }))
        : [];

    const diagnosis = Array.isArray(raw.diagnosis)
        ? raw.diagnosis.map((diag: any) => ({
              ...diag,
              provider: sanitizeProvider(diag.provider),
              status: sanitizeStatus(diag.status),
          }))
        : [];

    const optimizations = Array.isArray(raw.optimizations)
        ? raw.optimizations.map((opt: any) => ({
              ...opt,
              provider: sanitizeProvider(opt.provider),
              priority: sanitizeImpact(opt.priority || opt.impact),
              effort: sanitizeEffort(opt.effort),
          }))
        : [];

    return { recommendations, diagnosis, optimizations };
}
