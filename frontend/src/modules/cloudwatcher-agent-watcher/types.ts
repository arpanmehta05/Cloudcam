import type { SystemType } from "./constants";

export type ReportStatus = "pending_score" | "scored" | "invalid";
export type PassFailStatus = "pass" | "fail" | "manual_review" | "not_run";

export interface AgentLatestReport {
  report_id: string;
  status: ReportStatus;
  score: number | null;
  submitted_at: string;
}

export interface Agent {
  id: string;
  agent_id: string;
  display_name: string | null;
  created_at: string;
  latest_report: AgentLatestReport | null;
}

export interface ReportSummary {
  report_id: string;
  system_type: SystemType;
  skill_name: string;
  skill_version: string;
  submitted_at: string;
  status: ReportStatus;
  score: number | null;
}

export interface TestResult {
  id: string;
  category: string;
  test_name: string;
  input: unknown;
  output: unknown;
  pass_fail_status: PassFailStatus;
  notes: string;
  latency_ms?: number;
  cost_usd?: number;
  citations?: Array<Record<string, unknown>>;
  tool_calls?: Array<Record<string, unknown>>;
  metadata?: TestEvidenceMetadata;
}

export interface TestEvidenceReference {
  source_type: "source_file" | "test" | "runtime_trace" | "log" | "config" | "command" | "manual_inspection";
  location: string;
  claim: string;
  excerpt: string;
  reliability: "high" | "medium" | "low";
}

export interface TestEvidenceMetadata {
  evidence?: TestEvidenceReference[];
  verification?: { method: string; outcome: string; environment: string; commands?: string[] };
  risk?: { severity: "critical" | "high" | "medium" | "low" | "info"; likelihood: string; impact: string; affected_surface: string };
  remediation?: { recommended_action: string; validation: string };
  [key: string]: unknown;
}

export interface RawReportJson {
  agent_id?: string;
  agent_name?: string;
  system_type?: string;
  skill_name?: string;
  skill_version?: string;
  timestamp?: string;
  target?: {
    name?: string;
    model?: string;
    environment?: string;
    repository?: string;
    maturity?: string;
    evidence?: Record<string, unknown>;
  };
  audit_report?: Record<string, unknown>;
  scoring_inputs?: Record<string, unknown>;
  test_results?: unknown[];
  raw_summary?: string;
}

export interface ReportDetail {
  report_id: string;
  agent_id: string | null;
  system_type: SystemType;
  skill_name: string;
  skill_version: string;
  submitted_at: string;
  status: ReportStatus;
  /** Overall score (0..1 float, displayed as 0-100). Computed by the backend. */
  score: number | null;
  /**
   * Evidence-adjusted score per category (0..1), keyed by category string.
   * Empty object ({}) for reports scored before this feature was added.
   * When present, these values should be preferred over the frontend-computed ratio.
   */
  category_scores: Record<string, number>;
  /** The actual score cap applied by the backend (0..1). null means no cap was triggered. */
  applied_score_cap: number | null;
  /** Raw evidence-adjusted score before harness cap. null when no cap was applied. */
  raw_score_before_cap: number | null;
  raw_report_json: RawReportJson;
  test_results: TestResult[];
}

export interface CategorySummary {
  category: string;
  passed: number;
  failed: number;
  manualReview: number;
  notRun: number;
  /** passed + failed only (does not include manual_review or not_run) */
  scored: number;
  /** Total test count for this category (all statuses). */
  total: number;
  /**
   * Evidence-adjusted score for this category (0..1).
   * Uses backend-computed score when available (preferred);
   * falls back to a simple frontend estimate when the backend score is absent
   * (e.g., report is still pending, or pre-dates the categoryScores feature).
   */
  ratio: number;
}
