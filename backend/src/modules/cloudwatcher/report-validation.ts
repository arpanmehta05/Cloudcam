import { z } from "zod";

const systemTypeSchema = z.enum(["raw-llm-api", "rag-pipeline", "agent-tools", "chatbot"]);
const passFailSchema = z.enum(["pass", "fail", "manual_review", "not_run"]);
const jsonLike = z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]);
const auditStatusSchema = z.enum(["present", "partial", "missing", "not_applicable"]);
const evidenceReferenceSchema = z.object({
  source_type: z.enum(["source_file", "test", "runtime_trace", "log", "config", "command", "manual_inspection"]),
  location: z.string().trim().min(1).max(500),
  claim: z.string().trim().min(1).max(1000),
  excerpt: z.string().trim().min(1).max(2000),
  reliability: z.enum(["high", "medium", "low"]),
}).strict();
const verificationSchema = z.object({
  method: z.string().trim().min(1).max(500),
  outcome: z.string().trim().min(1).max(1000),
  environment: z.string().trim().min(1).max(240),
  commands: z.array(z.string().trim().min(1).max(1000)).max(12).optional(),
}).strict();
const riskSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  likelihood: z.string().trim().min(1).max(500),
  impact: z.string().trim().min(1).max(1000),
  affected_surface: z.string().trim().min(1).max(500),
}).strict();
const remediationSchema = z.object({
  recommended_action: z.string().trim().min(1).max(1500),
  validation: z.string().trim().min(1).max(1000),
}).strict();

export const cloudWatcherReportInputSchema = z.object({
  agent_id: z.string().trim().min(1).max(160),
  agent_name: z.string().trim().min(1).max(160).optional(),
  system_type: systemTypeSchema,
  skill_name: z.string().trim().min(1).max(160),
  skill_version: z.string().trim().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
  timestamp: z.string().datetime(),
  target: z.record(z.unknown()).optional(),
  audit_report: z.object({
    markdown_path: z.string().max(500).optional(),
    executive_summary: z.string().max(4000).optional(),
    gap_analysis: z.array(z.record(z.unknown())).optional(),
    recommended_modules: z.array(z.string().max(500)).optional(),
    data_models: z.array(z.string().max(500)).optional(),
    roadmap: z.array(z.record(z.unknown())).optional(),
    backlog: z.array(z.record(z.unknown())).optional(),
    open_questions: z.array(z.string().max(1000)).optional(),
    final_recommendations: z.array(z.string().max(1000)).optional(),
  }).passthrough().optional(),
  scoring_inputs: z.object({
    critical_gaps: z.array(z.string().max(1000)).optional(),
    score_caps: z.array(z.record(z.unknown())).optional(),
    do_not_build_yet: z.array(z.string().max(1000)).optional(),
    evidence_confidence: z.enum(["high", "medium", "low"]).optional(),
  }).passthrough().optional(),
  test_results: z.array(z.object({
    category: z.string().trim().min(1).max(160),
    test_name: z.string().trim().min(1).max(240),
    input: jsonLike,
    output: z.union([jsonLike, z.null()]),
    pass_fail: passFailSchema,
    notes: z.string().max(4000),
    latency_ms: z.number().min(0).optional(),
    cost_usd: z.number().min(0).optional(),
    citations: z.array(z.record(z.unknown())).optional(),
    tool_calls: z.array(z.record(z.unknown())).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).strict()).min(1),
  raw_summary: z.string().trim().min(1).max(4000),
}).strict().superRefine((report, ctx) => {
  const evidence = typeof report.target?.evidence === "object" && report.target.evidence
    ? report.target.evidence as Record<string, unknown>
    : null;
  const audit = evidence?.harness_audit;
  const isV2 = report.skill_version.startsWith("2.");
  if ((!audit || typeof audit !== "object") && !isV2) return;

  for (const [area, status] of Object.entries((audit || {}) as Record<string, unknown>)) {
    const parsed = auditStatusSchema.safeParse(status);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target", "evidence", "harness_audit", area],
        message: "harness audit statuses must be present, partial, missing, or not_applicable",
      });
    }
  }

  // Version 2 evidence-led skills intentionally fail closed. Older reports remain
  // readable, while current skills cannot submit a pass/fail without reproducible proof.
  if (!isV2) return;

  const requiredAreas = [
    "input_handling", "context", "prompt", "tool_calling", "planning_orchestration",
    "state_management", "memory", "output_validation", "evaluation", "observability",
    "security", "human_in_loop", "deployment_ops",
  ];
  const auditRecord = audit as Record<string, unknown>;
  for (const area of requiredAreas) {
    if (!auditRecord[area]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target", "evidence", "harness_audit", area],
        message: "version 2 reports must classify every harness area",
      });
    }
  }

  const filesInspected = evidence?.files_inspected;
  if (!Array.isArray(filesInspected) || filesInspected.length < 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["target", "evidence", "files_inspected"],
      message: "version 2 reports require at least five inspected file paths",
    });
  }

  report.test_results.forEach((result, index) => {
    const metadata = result.metadata;
    if (!metadata || typeof metadata !== "object") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["test_results", index, "metadata"], message: "version 2 checks require structured evidence metadata" });
      return;
    }
    const record = metadata as Record<string, unknown>;
    for (const [key, schema] of Object.entries({ evidence: z.array(evidenceReferenceSchema).min(1), verification: verificationSchema, risk: riskSchema, remediation: remediationSchema })) {
      const parsed = schema.safeParse(record[key]);
      if (!parsed.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["test_results", index, "metadata", key], message: `version 2 checks require valid ${key}` });
      }
    }
  });
});

export type CloudWatcherReportInput = z.infer<typeof cloudWatcherReportInputSchema>;

export function validateCloudWatcherReport(body: unknown) {
  const parsed = cloudWatcherReportInputSchema.safeParse(body);
  if (parsed.success) {
    return { valid: true as const, data: parsed.data };
  }

  return {
    valid: false as const,
    errors: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })),
  };
}
