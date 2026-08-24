import { z } from "zod";

const EvidenceSchema = z.object({
    factId: z.string(),
    content: z.string(),
    source: z.string(),
    value: z.number().optional(),
    unit: z.string().optional(),
}).passthrough();

const ActionTargetSchema = z.object({
    resourceId: z.string(),
    resourceName: z.string(),
    region: z.string(),
}).passthrough();

const ActionPlanSchema = z.object({
    actionId: z.string(),
    targets: z.array(ActionTargetSchema),
    estimatedSavings: z.number(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]),
    reasoning: z.string(),
    warnings: z.array(z.string()),
}).passthrough();

export const ChatResponseSchema = z.object({
    success: z.boolean(),
    sessionId: z.string(),
    response: z.object({
        summary: z.string(),
        followUp: z.array(z.string()).default([]),
        details: z.object({}).passthrough().optional(),
        actionPlans: z.array(ActionPlanSchema).optional(),
    }).passthrough(),
    evidence: z.array(EvidenceSchema).default([]),
    metadata: z.object({
        intent: z.string(),
        services: z.array(z.string()),
        stage1Time: z.number(),
        stage2Time: z.number(),
        totalTime: z.number(),
        classifierConfidence: z.number().optional(),
        needsClarification: z.boolean().optional(),
        grounding: z.object({
            score: z.number(),
            threshold: z.number(),
            totalCitations: z.number(),
            validCitations: z.number(),
            missingCitations: z.array(z.string()).default([]),
            degraded: z.boolean(),
        }).optional(),
        retrieval: z.object({
            totalFacts: z.number(),
            selectedFacts: z.number(),
            factSheetChars: z.number(),
            budgetChars: z.number(),
        }).optional(),
        dataQuality: z.object({
            fetchedAt: z.string(),
            complete: z.boolean(),
            sourceStatuses: z.object({
                inventory: z.string(),
                metrics: z.string(),
                billing: z.string(),
                security: z.string(),
            }).passthrough(),
            failedSources: z.array(z.string()).default([]),
        }).optional(),
    }).passthrough(),
}).passthrough();

export type ChatResponseDto = z.infer<typeof ChatResponseSchema>;
