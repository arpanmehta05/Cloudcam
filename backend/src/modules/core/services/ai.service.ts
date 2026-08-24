// Analysis Service -- rule-based + optional Gemini AI insights from Direct AWS SDK metrics
// ponytail: rule-based fallback -> Gemini AI analysis engine
import { z } from "zod";
import { buildFactSheet } from "../../../data/fact-builder";
import { ALL_SERVICES } from "../../../data/service-registry";
import { generateJsonContent, isGeminiConfigured } from "../../../providers/gemini.provider";
import { analyzeRules } from "../../../services/analysis-rules";
import { ParsedIntent } from "../../../models/chat.model";
import { getVpsErrorOptimizationContext } from "../../vps-logs";
import { AppError } from "../../../errors/app-error";
import { logger } from "../../../core/logger";

const AI_TIMEOUT_MS = Number(process.env.AI_ENHANCEMENT_TIMEOUT_MS) || 20_000;
const FACT_BUILD_TIMEOUT_MS = 25_000;

const ImpactEnum = z.preprocess(
  (v) => (typeof v === "string" ? v.toLowerCase().trim() : v),
  z.enum(["high", "medium", "low"]).catch("medium"),
);

const PriorityEnum = z.preprocess(
  (v) => (typeof v === "string" ? v.toLowerCase().trim() : v),
  z.enum(["high", "medium", "low"]).catch("medium"),
);

const EffortEnum = z.preprocess(
  (v) => (typeof v === "string" ? v.toLowerCase().trim() : v),
  z.enum(["low", "medium", "high"]).catch("medium"),
);

const StatusEnum = z.preprocess(
  (v) => (typeof v === "string" ? v.toLowerCase().trim() : v),
  z.enum(["healthy", "warning", "critical"]).catch("warning"),
);

const CategoryEnum = z.preprocess(
  (v) => (typeof v === "string" ? v.toLowerCase().trim() : v),
  z.enum(["cost", "performance", "security", "reliability"]).catch("cost"),
);

const NonEmptyString = z.preprocess(
  (v) => (v == null ? "" : typeof v === "string" ? v : String(v)),
  z.string().min(1).catch("---"),
);

const InsightRecommendationSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  description: NonEmptyString,
  impact: ImpactEnum,
  category: CategoryEnum,
  savings: NonEmptyString,
  action: NonEmptyString,
}).passthrough();

const InsightDiagnosisSchema = z.object({
  title: NonEmptyString,
  status: StatusEnum,
  details: NonEmptyString,
}).passthrough();

const InsightOptimizationSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  description: NonEmptyString,
  priority: PriorityEnum,
  effort: EffortEnum,
  savings: NonEmptyString,
  action: NonEmptyString,
}).passthrough();

const InsightsSchema = z.object({
  recommendations: z.array(InsightRecommendationSchema).catch([]),
  diagnosis: z.array(InsightDiagnosisSchema).catch([]),
  optimizations: z.array(InsightOptimizationSchema).catch([]),
}).passthrough();

function normalizeInsightsPayload(raw: any): any {
  if (!raw || typeof raw !== "object") return { recommendations: [], diagnosis: [], optimizations: [] };

  const ensureArray = (v: any) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const recs = ensureArray(raw.recommendations);
  const diag = ensureArray(raw.diagnosis ?? raw.diagnoses);
  const opts = ensureArray(raw.optimizations);

  return {
    ...raw,
    recommendations: recs.map((r: any, i: number) => ({
      id: r?.id || `rec-${i + 1}`,
      title: r?.title ?? r?.name ?? "Recommendation",
      description: r?.description ?? r?.detail ?? r?.summary ?? "",
      impact: r?.impact ?? r?.severity ?? "medium",
      category: r?.category ?? r?.type ?? "cost",
      savings: r?.savings ?? r?.estimatedSavings ?? "$0/mo",
      action: r?.action ?? r?.actionable ?? r?.next_step ?? r?.nextStep ?? "",
    })),
    diagnosis: diag.map((d: any) => ({
      title: d?.title ?? d?.name ?? "Finding",
      status: d?.status ?? d?.health ?? "warning",
      details: d?.details ?? d?.detail ?? d?.description ?? "",
    })),
    optimizations: opts.map((o: any, i: number) => ({
      id: o?.id || `opt-${i + 1}`,
      title: o?.title ?? o?.name ?? "Optimization",
      description: o?.description ?? o?.detail ?? o?.summary ?? "",
      priority: o?.priority ?? o?.impact ?? "medium",
      effort: o?.effort ?? o?.complexity ?? "medium",
      savings: o?.savings ?? o?.estimatedSavings ?? "$0/mo",
      action: o?.action ?? o?.actionable ?? o?.next_step ?? o?.nextStep ?? "",
    })),
  };
}

function extractArray(raw: any, key: "recommendations" | "diagnosis" | "optimizations"): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    if (key === "diagnosis") {
      const diag = (raw as any).diagnosis ?? (raw as any).diagnoses;
      if (Array.isArray(diag)) return diag;
      if (diag != null) return [diag];
    }
    const val = (raw as any)[key];
    if (Array.isArray(val)) return val;
    if (val != null) return [val];
  }
  return [];
}

function parseInsights(raw: any) {
  const normalized = normalizeInsightsPayload({
    recommendations: extractArray(raw, "recommendations"),
    diagnosis: extractArray(raw, "diagnosis"),
    optimizations: extractArray(raw, "optimizations"),
  });
  const parsed = InsightsSchema.safeParse(normalized);
  if (!parsed.success) {
    logger.error("[AI] Schema validation failed: " + JSON.stringify(parsed.error.flatten()));
  }
  return parsed.success ? parsed.data : {
    recommendations: Array.isArray(normalized?.recommendations) ? normalized.recommendations : [],
    diagnosis: Array.isArray(normalized?.diagnosis) ? normalized.diagnosis : [],
    optimizations: Array.isArray(normalized?.optimizations) ? normalized.optimizations : [],
  };
}

interface AiPromptOpts {
  factSheet: string;
  mtdSpend: number;
  projectedMonthly: number;
  resourceCount: number;
  vpsErrorContext?: string;
}

function buildAiPrompt(opts: AiPromptOpts): string {
  const { factSheet, mtdSpend, projectedMonthly, resourceCount, vpsErrorContext } = opts;
  return `You are an expert AWS Cloud Architect and FinOps specialist. Analyze this infrastructure Fact Sheet.

## INFRASTRUCTURE FACT SHEET
${factSheet}

## BILLING CONTEXT
- Month-to-Date Spend: $${mtdSpend.toFixed(2)}
- Projected Full Month: $${projectedMonthly.toFixed(2)}
- Total Active Resources: ${resourceCount}

${vpsErrorContext ? `## VPS APPLICATION ERRORS\n${vpsErrorContext}` : ""}

## YOUR TASK
Return a single JSON object with 3 sections:

{
  "recommendations": [
    { "id": "rec-1", "title": "short title", "description": "detail with data points", "impact": "high|medium|low", "category": "cost|performance|security|reliability", "savings": "$XX/mo", "action": "AWS CLI or Console step" }
  ],
  "diagnosis": [
    { "title": "finding", "status": "healthy|warning|critical", "details": "data-backed finding" }
  ],
  "optimizations": [
    { "id": "opt-1", "title": "title", "description": "detail", "priority": "high|medium|low", "effort": "low|medium|high", "savings": "$XX/mo", "action": "step" }
  ]
}

RULES:
- savings field is REQUIRED. Never "$0". Use billing breakdown to estimate.
- Idle (0% utilization) -> savings = FULL cost. Underutilized (<30% CPU) -> 40-60% savings.
- Base findings ONLY on the Fact Sheet data.
- Return ONLY JSON, no other text.`;
}

async function withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<{ ok: boolean; value?: T }> {
  let timer: NodeJS.Timeout | null = null;
  const timerPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    const value = await Promise.race([fn(), timerPromise]);
    return { ok: true, value };
  } catch {
    return { ok: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function analyzeInfrastructure(workspaceId: string, roleArn?: string, externalId?: string) {
  const t0 = Date.now();

  const comprehensiveIntent: ParsedIntent = {
    intent: "cost_optimization",
    services: ALL_SERVICES,
    dataSources: { metrics: true, logs: false, costExplorer: true },
    timeRange: "7d",
    isFollowUp: false,
  };

  try {
    // Phase 1: Fact sheet (with timeout)
    const t1 = Date.now();
    const factResult = await withTimeout(FACT_BUILD_TIMEOUT_MS, () => buildFactSheet(comprehensiveIntent, workspaceId, roleArn, externalId));
    const factMs = Date.now() - t1;

    if (!factResult.ok || !factResult.value) {
      throw new AppError({
        code: "ERR_FACT_BUILD_TIMEOUT",
        message: "Infrastructure scan timed out. Please try again or check your AWS connection.",
        status: 504,
        retryable: true,
      });
    }

    const { facts, rawData, factSheet } = factResult.value;

    // Phase 2: Rule-based analysis (<5ms)
    const t2 = Date.now();
    const ruleInsights = analyzeRules(rawData, facts);
    const ruleMs = Date.now() - t2;

    const mtdSpend = rawData.billing?.mtd?.total || 0;
    const forecastSpend = rawData.billing?.forecast?.amount || 0;
    const projectedMonthly = mtdSpend + forecastSpend;
    const resourceCount = rawData.inventory?.counts?.total || 0;

    logger.info(`[AI] phases -- fact-sheet: ${factMs}ms | rules: ${ruleMs}ms | facts: ${facts.length} | recs: ${ruleInsights.recommendations.length}`);

    // Phase 3: Optional AI enhancement (with timeout)
    if (isGeminiConfigured()) {
      const t3 = Date.now();
      const result = await withTimeout(AI_TIMEOUT_MS, async () => {
        const vpsErrorContext = await getVpsErrorOptimizationContext(workspaceId, 24);
        const raw = await generateJsonContent(buildAiPrompt({
          factSheet, mtdSpend, projectedMonthly, resourceCount, vpsErrorContext,
        }));
        const insights = parseInsights(raw);
        return { insights, vpsErrorContext } as const;
      });

      const aiMs = Date.now() - t3;

      if (result.ok && result.value) {
        const totalMs = Date.now() - t0;
        logger.info(`[AI] phases -- ai: ${aiMs}ms | total: ${totalMs}ms | source: gemini | recs: ${result.value.insights.recommendations.length}`);
        return {
          success: true,
          insights: result.value.insights,
          metrics: { ...rawData, vpsErrorContext: result.value.vpsErrorContext },
          source: "gemini" as const,
          timestamp: new Date().toISOString(),
        };
      }

      logger.info(`[AI] Enhancement skipped/timed out after ${aiMs}ms (> ${AI_TIMEOUT_MS}ms) -- falling back to rules`);
    }

    // Rule-based results (fallback or if Gemini not configured)
    const totalMs = Date.now() - t0;
    logger.info(`[AI] phases -- total: ${totalMs}ms | source: rules`);
    return {
      success: true,
      insights: ruleInsights,
      metrics: rawData,
      source: "rules" as const,
      timestamp: new Date().toISOString(),
    };

  } catch (error: any) {
    if (error instanceof AppError) throw error;

    throw new AppError({
      code: "ERR_INTERNAL",
      message: "Failed to perform infrastructure analysis",
      status: 502,
      retryable: true,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
