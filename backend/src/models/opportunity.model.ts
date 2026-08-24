import { z } from "zod";

export const OpportunityTypeSchema = z.enum([
  "rightsizing",
  "spot_migration",
  "savings_plan",
  "reserved_instance",
  "orphaned_ebs",
  "orphaned_rds",
  "orphaned_s3",
]);

export const OpportunityRiskSchema = z.enum(["low", "medium", "high"]);
export const OpportunityEffortSchema = z.enum(["low", "medium", "high"]);

export const OpportunityEvidenceSchema = z.object({
  source: z.string(),
  metric: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  window: z.string().optional(),
});

export const NormalizedOpportunitySchema = z.object({
  id: z.string().min(1),
  insightId: z.string().min(1),
  type: OpportunityTypeSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  actionId: z.string().min(1),
  resource: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    region: z.string().min(1),
  }),
  risk: OpportunityRiskSchema,
  effort: OpportunityEffortSchema,
  economics: z.object({
    baselineMonthlyCost: z.number().nonnegative(),
    estimatedMonthlySavings: z.number().nonnegative(),
    estimatedSavingsPercent: z.number().min(0).max(100),
  }),
  scoring: z.object({
    priorityScore: z.number().nonnegative(),
    confidenceScore: z.number().min(0).max(1),
    riskWeight: z.number().positive(),
  }),
  detector: z.object({
    id: z.string().min(1),
    mode: z.literal("deterministic"),
    reasonCodes: z.array(z.string()).default([]),
  }),
  feedback: z.object({
    multiplier: z.number().positive(),
    sampleSize: z.number().int().nonnegative(),
    calibrated: z.boolean(),
  }),
  evidence: z.array(OpportunityEvidenceSchema).default([]),
  generatedAt: z.string(),
  stale: z.boolean().default(false),
});

export const OptimizationScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  strategy: z.enum(["conservative", "balanced", "aggressive"]),
  assumptions: z.array(z.string()).default([]),
  opportunityIds: z.array(z.string()).default([]),
  estimatedMonthlySavings: z.number().nonnegative(),
  estimatedAnnualSavings: z.number().nonnegative(),
  confidenceScore: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(100),
  selectedCount: z.number().int().nonnegative(),
});

export type OpportunityType = z.infer<typeof OpportunityTypeSchema>;
export type NormalizedOpportunity = z.infer<typeof NormalizedOpportunitySchema>;
export type OptimizationScenario = z.infer<typeof OptimizationScenarioSchema>;
