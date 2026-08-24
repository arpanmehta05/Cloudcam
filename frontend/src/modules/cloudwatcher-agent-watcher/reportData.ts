// Normalizers that turn the loosely-typed `raw_report_json` blob into safe,
// typed shapes the report UI can render. The executing agent submits a large,
// evidence-rich payload (audit_report, scoring_inputs, target.evidence) that the
// backend stores verbatim. Most of it was never surfaced — these helpers unlock it.

import type { ReportDetail } from "./types";
import type { SystemType } from "./constants";

// ── Low-level safe accessors ───────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
}

/** Pull the first defined string among a set of candidate keys. */
function pick(record: Record<string, unknown> | null, ...keys: string[]): string {
  if (!record) return "";
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return "";
}

// ── Harness taxonomy ───────────────────────────────────────────────────────

export type HarnessStatus = "present" | "partial" | "missing" | "not_applicable";
export type HarnessStatusOrUnknown = HarnessStatus | "unknown";

export interface TaxonomyArea {
  key: string;
  label: string;
  status: HarnessStatusOrUnknown;
  critical: boolean;
}

const TAXONOMY_LABELS: Record<string, string> = {
  input_handling: "Input handling",
  context: "Context assembly",
  prompt: "Prompt architecture",
  tool_calling: "Tool calling",
  planning_orchestration: "Planning & orchestration",
  state_management: "State management",
  memory: "Memory",
  output_validation: "Output validation",
  evaluation: "Evaluation & evals",
  observability: "Observability",
  security: "Security & privacy",
  human_in_loop: "Human-in-the-loop",
  deployment_ops: "Deployment & ops",
};

// Backend enforces classification of all 13 areas for v2 reports. Order is the
// canonical audit order — keep it stable so the grid reads like a checklist.
const TAXONOMY_ORDER = Object.keys(TAXONOMY_LABELS);

// Critical areas gate the top score band. A base set applies to every system,
// with type-specific additions (tools for agents, retrieval context for RAG).
const BASE_CRITICAL = new Set([
  "input_handling",
  "prompt",
  "output_validation",
  "evaluation",
  "observability",
  "security",
  "deployment_ops",
]);

function criticalAreasFor(systemType: SystemType): Set<string> {
  const set = new Set(BASE_CRITICAL);
  if (systemType === "agent-tools") {
    set.add("tool_calling");
    set.add("planning_orchestration");
    set.add("human_in_loop");
  }
  if (systemType === "rag-pipeline") set.add("context");
  if (systemType === "chatbot") {
    set.add("state_management");
    set.add("memory");
  }
  return set;
}

function normalizeStatus(value: unknown): HarnessStatusOrUnknown {
  const raw = asString(value).toLowerCase();
  if (raw === "present" || raw === "partial" || raw === "missing" || raw === "not_applicable") return raw;
  return "unknown";
}

// ── Score caps ─────────────────────────────────────────────────────────────

export interface ScoreCap {
  cap: number | null; // 0..1
  reason: string;
  area: string;
}

function normalizeScoreCap(record: Record<string, unknown>): ScoreCap {
  const capValueRaw = record.cap ?? record.max_score ?? record.value ?? record.ceiling;
  const cap = typeof capValueRaw === "number" && Number.isFinite(capValueRaw) ? capValueRaw : null;
  return {
    cap: cap !== null && cap > 1 ? cap / 100 : cap, // tolerate 0..100 caps
    reason: pick(record, "reason", "why", "justification", "detail", "description"),
    area: pick(record, "area", "control", "harness_area", "category", "name"),
  };
}

// ── Gap analysis rows ──────────────────────────────────────────────────────

export interface GapRow {
  area: string;
  severity: string;
  finding: string;
  evidence: string;
  action: string;
  validation: string;
}

function normalizeGapRow(record: Record<string, unknown>): GapRow {
  return {
    area: pick(record, "area", "control", "harness_area", "category", "surface", "component"),
    severity: pick(record, "severity", "risk", "priority").toLowerCase(),
    finding: pick(record, "finding", "gap", "issue", "description", "summary", "observation"),
    evidence: pick(record, "evidence", "evidence_location", "location", "source", "path"),
    action: pick(record, "recommended_action", "action", "remediation", "fix", "recommendation"),
    validation: pick(record, "validation", "verification", "proof", "acceptance"),
  };
}

// ── Aggregate view model ───────────────────────────────────────────────────

export interface TargetMeta {
  name: string;
  model: string;
  environment: string;
  repository: string;
  maturity: string;
}

export interface SurfaceEvidence {
  filesInspected: string[];
  repoMap: string[];
  aiSurfaceAreas: string[];
  modelCallSites: string[];
  retrievalPaths: string[];
  toolPaths: string[];
  chatOrMemoryPaths: string[];
  testOrEvalPaths: string[];
  deploymentPaths: string[];
  existingHarness: string[];
  harnessGaps: string[];
}

export interface DeepReport {
  target: TargetMeta;
  executiveSummary: string;
  rawSummary: string;
  taxonomy: TaxonomyArea[];
  taxonomyCounts: Record<HarnessStatusOrUnknown, number>;
  criticalMissing: TaxonomyArea[];
  gapAnalysis: GapRow[];
  recommendedModules: string[];
  dataModels: string[];
  finalRecommendations: string[];
  openQuestions: string[];
  criticalGaps: string[];
  scoreCaps: ScoreCap[];
  doNotBuildYet: string[];
  evidenceConfidence: "high" | "medium" | "low" | null;
  surface: SurfaceEvidence;
}

export function buildDeepReport(report: ReportDetail): DeepReport {
  const root = report.raw_report_json ?? {};
  const target = asRecord(root.target) ?? {};
  const evidence = asRecord(target.evidence) ?? {};
  const audit = asRecord(root.audit_report) ?? {};
  const scoring = asRecord(root.scoring_inputs) ?? {};

  const harnessAudit = asRecord(evidence.harness_audit) ?? {};
  const critical = criticalAreasFor(report.system_type);

  // Build the ordered taxonomy: canonical areas first, then any extra keys the
  // agent classified that we don't have a canonical label for.
  const extraKeys = Object.keys(harnessAudit).filter((key) => !TAXONOMY_ORDER.includes(key));
  const taxonomy: TaxonomyArea[] = [...TAXONOMY_ORDER, ...extraKeys].map((key) => ({
    key,
    label: TAXONOMY_LABELS[key] ?? key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    status: normalizeStatus(harnessAudit[key]),
    critical: critical.has(key),
  }));

  const taxonomyCounts = taxonomy.reduce(
    (acc, area) => {
      acc[area.status] += 1;
      return acc;
    },
    { present: 0, partial: 0, missing: 0, not_applicable: 0, unknown: 0 } as Record<HarnessStatusOrUnknown, number>,
  );

  const criticalMissing = taxonomy.filter(
    (area) => area.critical && (area.status === "missing" || area.status === "partial"),
  );

  const confidenceRaw = asString(scoring.evidence_confidence).toLowerCase();
  const evidenceConfidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low" ? confidenceRaw : null;

  return {
    target: {
      name: pick(target, "name") || report.agent_id || "Audited system",
      model: pick(target, "model"),
      environment: pick(target, "environment"),
      repository: pick(target, "repository"),
      maturity: pick(target, "maturity"),
    },
    executiveSummary: pick(audit, "executive_summary"),
    rawSummary: asString(root.raw_summary),
    taxonomy,
    taxonomyCounts,
    criticalMissing,
    gapAnalysis: asRecordArray(audit.gap_analysis).map(normalizeGapRow).filter((row) => row.finding || row.area),
    recommendedModules: asStringArray(audit.recommended_modules),
    dataModels: asStringArray(audit.data_models),
    finalRecommendations: asStringArray(audit.final_recommendations),
    openQuestions: asStringArray(audit.open_questions),
    criticalGaps: asStringArray(scoring.critical_gaps),
    scoreCaps: asRecordArray(scoring.score_caps).map(normalizeScoreCap),
    doNotBuildYet: asStringArray(scoring.do_not_build_yet),
    evidenceConfidence,
    surface: {
      filesInspected: asStringArray(evidence.files_inspected),
      repoMap: asStringArray(evidence.repo_map),
      aiSurfaceAreas: asStringArray(evidence.ai_surface_areas),
      modelCallSites: asStringArray(evidence.model_call_sites),
      retrievalPaths: asStringArray(evidence.retrieval_paths),
      toolPaths: asStringArray(evidence.tool_paths),
      chatOrMemoryPaths: asStringArray(evidence.chat_or_memory_paths),
      testOrEvalPaths: asStringArray(evidence.test_or_eval_paths),
      deploymentPaths: asStringArray(evidence.deployment_paths),
      existingHarness: asStringArray(evidence.existing_harness),
      harnessGaps: asStringArray(evidence.harness_gaps),
    },
  };
}

// ── Presentation helpers shared across the new sections ─────────────────────

export const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// Minimal palette: blue / white / ink / slate only. Severity is encoded by
// contrast weight (solid ink → light gray), not by hue.
export function severityTone(severity: string): { badge: string; dot: string; label: string } {
  switch (severity) {
    case "critical":
      return { badge: "border-[#0F172A] bg-[#0F172A] text-white", dot: "bg-[#0F172A]", label: "Critical" };
    case "high":
      return { badge: "border-[#0F172A] bg-white text-[#0F172A]", dot: "bg-[#334155]", label: "High" };
    case "medium":
      return { badge: "border-[#CBD5E1] bg-white text-[#475569]", dot: "bg-[#94A3B8]", label: "Medium" };
    case "low":
      return { badge: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1A56DB]", dot: "bg-[#1A56DB]", label: "Low" };
    default:
      return { badge: "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]", dot: "bg-[#CBD5E1]", label: severity ? severity[0].toUpperCase() + severity.slice(1) : "Info" };
  }
}

// present = brand blue, missing = ink (highest contrast draws the eye),
// partial = slate, N/A / unknown = light gray. No greens or reds.
export const STATUS_TONE: Record<HarnessStatusOrUnknown, { label: string; chip: string; bar: string; text: string }> = {
  present: { label: "Present", chip: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1A56DB]", bar: "bg-[#1A56DB]", text: "text-[#1A56DB]" },
  partial: { label: "Partial", chip: "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]", bar: "bg-[#94A3B8]", text: "text-[#475569]" },
  missing: { label: "Missing", chip: "border-[#0F172A] bg-[#0F172A] text-white", bar: "bg-[#0F172A]", text: "text-[#0F172A]" },
  not_applicable: { label: "N/A", chip: "border-[#E2E8F0] bg-white text-[#94A3B8]", bar: "bg-[#E2E8F0]", text: "text-[#94A3B8]" },
  unknown: { label: "Unclassified", chip: "border-[#E2E8F0] bg-white text-[#94A3B8]", bar: "bg-[#E2E8F0]", text: "text-[#94A3B8]" },
};
