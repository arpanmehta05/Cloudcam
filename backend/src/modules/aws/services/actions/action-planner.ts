// Action Planner — Uses Gemini to convert natural language or recommendations into executable action plans
import { z } from "zod";
import { generateJsonContent } from "../../../../providers/gemini.provider";
import { ALL_ACTIONS, getActionById } from "../../../../data/action-registry";
import { ActionRequest } from "../../../../models/action.model";
import { AppError } from "../../../../core/errors/app-error";

export interface ActionPlan {
    actionId: string;
    targets: { resourceId: string; resourceName: string; region: string }[];
    estimatedSavings: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    reasoning: string;
    warnings: string[];
}

const ACTION_PLANNER_PROMPT = `You are an AWS infrastructure action planner for Rabbittize.
Given a user request or optimization recommendation, you must determine the EXACT action(s) to take.

AVAILABLE ACTIONS:
${ALL_ACTIONS.map((a) => `- ${a.id}: ${a.displayName} [${a.service}] — Risk: ${a.riskLevel}, Tier: ${a.tier}, Reversible: ${a.reversible}${a.downtimeWarning ? ", ⚠️ causes downtime" : ""}`).join("\n")}

SAFETY RULES:
1. NEVER recommend "ec2-terminate" unless the user explicitly says "terminate" or "delete permanently".
2. Prefer reversible actions (stop) over irreversible ones (terminate/delete).
3. If the user is vague, choose the safest tier that matches their intent.
4. For cost optimization, prefer lower-tier actions first (stop idle → rightsize → terminate).
5. Only include resources explicitly mentioned or clearly identified in the facts.
6. If you cannot determine the specific resource IDs, set targets to an empty array and explain.
7. For EBS delete, always recommend creating a snapshot first (ebs-snapshot before ebs-delete).
8. For RDS stop, warn that it auto-restarts after 7 days.
9. For ec2-rightsize and rds-resize, warn about downtime.
10. Consider dependencies before suggesting actions (e.g., don't stop RDS if EC2 apps depend on it).

ACTION SELECTION GUIDE:
- "stop idle/unused instances" → ec2-stop-idle
- "stop instance X" → ec2-stop
- "delete/terminate instance permanently" → ec2-terminate (ONLY if explicitly requested)
- "rightsize/resize EC2" → ec2-rightsize
- "stop/pause database" → rds-stop
- "resize/change RDS class" → rds-resize
- "backup database" → rds-snapshot
- "backup volume" → ebs-snapshot
- "delete unused volume" → ebs-delete (with snapshot first)
- "optimize Lambda" → lambda-optimize
- "add lifecycle policy to S3" → s3-lifecycle
- "enable DynamoDB autoscaling" → dynamodb-autoscale
- "scale ECS service" → ecs-scale
- "migrate ASG to Spot" → asg-spot-migration (ONLY for stateless workloads in ASGs with ≥2 AZs, behind a load balancer)
- "purchase Savings Plan/RI" → purchase-savings-plan (advisory only, generates a recommendation — no AWS purchase is made)

OUTPUT JSON ONLY:
{
  "actions": [
    {
      "actionId": "ec2-stop-idle",
      "targets": [{"resourceId": "i-xxxxx", "resourceName": "web-server-1", "region": "us-east-1"}],
      "estimatedSavings": 45.00,
      "riskLevel": "low",
      "reasoning": "Instance has < 5% CPU for 7 days",
      "warnings": []
    }
  ]
}

If no action is appropriate, return: {"actions": [], "reasoning": "Explanation of why no action is needed"}`;

const PlannerTargetSchema = z.object({
    resourceId: z.string().min(1),
    resourceName: z.string().nullable().optional().catch(undefined),
    region: z.string().nullable().optional().catch(undefined),
});

const PlannerActionSchema = z.object({
    actionId: z.string().min(1),
    targets: z.array(PlannerTargetSchema).nullable().optional().catch([]).transform(v => v || []),
    estimatedSavings: z.union([z.number(), z.string(), z.null()]).optional().catch(0).transform(v => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
            const num = parseFloat(v.replace(/[^0-9.-]+/g, ""));
            return isNaN(num) ? 0 : num;
        }
        return 0;
    }),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).nullable().optional().catch(undefined),
    reasoning: z.string().nullable().optional().catch(undefined),
    warnings: z.array(z.string()).nullable().optional().catch([]).transform(v => v || []),
});

const PlannerResponseSchema = z.union([
    z.object({
        actions: z.array(PlannerActionSchema).nullable().optional().catch([]).transform(v => v || []),
    }),
    z.array(PlannerActionSchema).transform(arr => ({ actions: arr }))
]).catch({ actions: [] });

export async function planActions(
    userMessage: string,
    factSheet: string,
    recommendations?: any[]
): Promise<ActionPlan[]> {
    const recContext = recommendations?.length
        ? `\n\nEXISTING RECOMMENDATIONS:\n${JSON.stringify(recommendations, null, 2)}`
        : "";

    const prompt = `${ACTION_PLANNER_PROMPT}

## INFRASTRUCTURE FACTS
${factSheet}
${recContext}

## USER REQUEST
"${userMessage}"

Return JSON only.`;

    const raw = await generateJsonContent(prompt);
    const parsed = PlannerResponseSchema.safeParse(raw);
    if (!parsed.success) {
        throw new AppError({
            code: "ERR_AI_OUTPUT_SCHEMA_INVALID",
            message: "Action planner returned invalid JSON shape",
            status: 502,
            retryable: true,
            details: parsed.error.flatten(),
        });
    }

    const plans: ActionPlan[] = parsed.data.actions
        .filter((a) => !!getActionById(a.actionId))
        .map((a) => ({
        actionId: a.actionId,
        targets: a.targets.map((t) => ({
            resourceId: t.resourceId,
            resourceName: t.resourceName || t.resourceId,
            region: t.region || "us-east-1",
        })),
        estimatedSavings: a.estimatedSavings,
        riskLevel: a.riskLevel || getActionById(a.actionId)!.riskLevel,
        reasoning: a.reasoning || "",
        warnings: a.warnings,
    }));

    return plans;
}

// Create an ActionRequest from a plan
export async function createActionRequest(
    plan: ActionPlan,
    userId: string,
    simulationMode: boolean = false
): Promise<any> {
    const actionDef = getActionById(plan.actionId);
    if (!actionDef) throw new Error(`Unknown action: ${plan.actionId}`);

    const actionReq = await ActionRequest.create({
        userId,
        actionId: plan.actionId,
        displayName: actionDef.displayName,
        service: actionDef.service,
        targets: plan.targets.map((target) => ({
            ...target,
            status: "pending",
        })),
        status: "pending_review",
        riskLevel: plan.riskLevel,
        reversible: actionDef.reversible,
        estimatedSavings: plan.estimatedSavings,
        safetyWarnings: plan.warnings,
        dependencyWarnings: [],
        simulationMode,
    });

    return actionReq;
}

// Convert a recommendation card (from /ai or /recommendations) into an action plan
export async function planFromRecommendation(
    recommendation: { title: string; description: string; action?: string; savings?: string; fact?: string },
    factSheet: string
): Promise<ActionPlan[]> {
    const message = `Execute this recommendation: ${recommendation.title}. ${recommendation.description}. Suggested action: ${recommendation.action || "N/A"}. Estimated savings: ${recommendation.savings || "unknown"}.`;
    return planActions(message, factSheet);
}
