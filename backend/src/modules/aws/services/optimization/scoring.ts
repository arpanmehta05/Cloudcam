import {
    NormalizedOpportunity,
    NormalizedOpportunitySchema,
    OptimizationScenario,
    OptimizationScenarioSchema,
} from "../../../../models/opportunity.model";
import { IOptimizationInsight } from "../../models/optimization-cache.model";

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

export function opportunityRisk(riskWeight: number): "low" | "medium" | "high" {
    if (riskWeight <= 1.2) return "low";
    if (riskWeight <= 1.6) return "medium";
    return "high";
}

export function opportunityEffort(type: string): "low" | "medium" | "high" {
    if (type === "orphaned_ebs" || type === "orphaned_rds" || type === "orphaned_s3") return "low";
    if (type === "rightsizing" || type === "spot_migration") return "medium";
    return "high";
}

export function opportunityTitle(type: string, resourceName: string): string {
    switch (type) {
        case "rightsizing":
            return `Right-size ${resourceName}`;
        case "spot_migration":
            return `Migrate ${resourceName} to Spot mix`;
        case "savings_plan":
            return "Purchase Compute Savings Plan coverage";
        case "reserved_instance":
            return "Increase Reserved Instance coverage";
        case "orphaned_ebs":
            return `Delete unattached volume ${resourceName}`;
        case "orphaned_rds":
            return `Delete stale RDS snapshot ${resourceName}`;
        case "orphaned_s3":
            return `Review orphaned S3 bucket ${resourceName}`;
        default:
            return `Optimize ${resourceName}`;
    }
}

export function opportunitySummary(type: string, insight: IOptimizationInsight): string {
    switch (type) {
        case "rightsizing":
            return `Detected over-provisioning with measurable utilization variance. Recommended resize can reduce compute spend while preserving performance baselines.`;
        case "spot_migration":
            return `Workload matches Spot eligibility rules (stateless + multi-AZ + interruption tolerance). Migrate blended capacity for immediate compute savings.`;
        case "savings_plan":
            return `Current On-Demand mix indicates commitment gap. Savings Plan coverage can reduce steady-state compute costs.`;
        case "reserved_instance":
            return `Reserved coverage is below target. Increasing RI coverage can reduce predictable baseline spend.`;
        case "orphaned_ebs":
            return `Volume appears unattached and incurs storage cost without serving workload demand.`;
        case "orphaned_rds":
            return `Snapshot age indicates potential retention drift. Review policy and remove stale backup artifacts.`;
        case "orphaned_s3":
            return `Bucket age and inactivity suggest cleanup or lifecycle transition opportunity.`;
        default:
            return `Deterministic optimization opportunity identified.`;
    }
}

interface FeedbackCalibration {
    multiplier: number;
    sampleSize: number;
    confidenceAdjustment: number;
}

export function applyFeedbackCalibration(
    actionId: string,
    estimatedMonthlySavings: number,
    confidence: number,
    calibrations: Map<string, FeedbackCalibration>
) {
    const calibration = calibrations.get(actionId);
    if (!calibration) {
        return {
            savings: round2(estimatedMonthlySavings),
            confidence: clamp(confidence, 0.2, 0.99),
            feedback: { multiplier: 1, sampleSize: 0, calibrated: false },
        };
    }

    return {
        savings: round2(estimatedMonthlySavings * calibration.multiplier),
        confidence: clamp(confidence + calibration.confidenceAdjustment, 0.2, 0.99),
        feedback: {
            multiplier: calibration.multiplier,
            sampleSize: calibration.sampleSize,
            calibrated: true,
        },
    };
}

export function insightToOpportunity(
    insight: IOptimizationInsight,
    calibrations: Map<string, FeedbackCalibration>
): NormalizedOpportunity {
    const estimatedMonthlySavings = round2(insight.estimatedMonthlySavings || 0);
    const baselineMonthlyCost = Math.max(round2(insight.currentMonthlyCost || 0), estimatedMonthlySavings);
    const estimatedSavingsPercent = baselineMonthlyCost > 0
        ? clamp(round2((estimatedMonthlySavings / baselineMonthlyCost) * 100), 0, 100)
        : 0;

    const fallbackCalibration = calibrations.get(insight.actionId);
    const metadataFeedback = (insight.metadata as Record<string, any> | undefined)?.feedback;
    const feedback = {
        multiplier: Number(metadataFeedback?.multiplier ?? fallbackCalibration?.multiplier ?? 1),
        sampleSize: Number(metadataFeedback?.sampleSize ?? fallbackCalibration?.sampleSize ?? 0),
        calibrated: Boolean(metadataFeedback?.calibrated ?? Boolean(fallbackCalibration)),
    };

    const evidence = [
        {
            source: "deterministic_engine",
            metric: "estimated_monthly_savings",
            value: estimatedMonthlySavings,
            unit: "USD/month",
            window: "30d",
        },
        {
            source: "deterministic_engine",
            metric: "confidence_factor",
            value: round2(insight.confidenceFactor || 0),
        },
    ];

    return NormalizedOpportunitySchema.parse({
        id: `opp-${insight._id.toString()}`,
        insightId: insight._id.toString(),
        type: insight.type,
        title: opportunityTitle(insight.type, insight.resourceName || insight.resourceId),
        summary: opportunitySummary(insight.type, insight),
        actionId: insight.actionId,
        resource: {
            id: insight.resourceId,
            name: insight.resourceName || insight.resourceId,
            region: insight.region || "global",
        },
        risk: opportunityRisk(insight.riskWeight || 1),
        effort: opportunityEffort(insight.type),
        economics: {
            baselineMonthlyCost,
            estimatedMonthlySavings,
            estimatedSavingsPercent,
        },
        scoring: {
            priorityScore: round2(insight.score || 0),
            confidenceScore: clamp(round2(insight.confidenceFactor || 0), 0, 1),
            riskWeight: round2(insight.riskWeight || 1),
        },
        detector: {
            id: String((insight.metadata as Record<string, any> | undefined)?.detector || insight.type),
            mode: "deterministic",
            reasonCodes: Array.isArray((insight.metadata as Record<string, any> | undefined)?.reasonCodes)
                ? (insight.metadata as Record<string, any>).reasonCodes
                : [],
        },
        feedback,
        evidence,
        generatedAt: insight.generatedAt.toISOString(),
        stale: !!insight.stale,
    });
}

export function buildScenario(
    id: string,
    name: string,
    strategy: "conservative" | "balanced" | "aggressive",
    opportunities: NormalizedOpportunity[],
    minConfidence: number,
    maxRiskWeight: number,
    maxCount: number,
    assumptions: string[]
): OptimizationScenario {
    const selected = opportunities
        .filter((opportunity) =>
            opportunity.scoring.confidenceScore >= minConfidence
            && opportunity.scoring.riskWeight <= maxRiskWeight
            && !opportunity.stale
        )
        .sort((a, b) => b.scoring.priorityScore - a.scoring.priorityScore)
        .slice(0, maxCount);

    const estimatedMonthlySavings = round2(
        selected.reduce((sum, opportunity) => sum + opportunity.economics.estimatedMonthlySavings, 0)
    );

    const confidenceDenominator = selected.reduce(
        (sum, opportunity) => sum + Math.max(opportunity.economics.estimatedMonthlySavings, 1),
        0
    );

    const confidenceScore = confidenceDenominator > 0
        ? clamp(round2(selected.reduce(
            (sum, opportunity) => sum + (opportunity.scoring.confidenceScore * Math.max(opportunity.economics.estimatedMonthlySavings, 1)),
            0
        ) / confidenceDenominator), 0, 1)
        : 0;

    const avgRiskWeight = selected.length > 0
        ? selected.reduce((sum, opportunity) => sum + opportunity.scoring.riskWeight, 0) / selected.length
        : 0;

    const riskScore = selected.length > 0
        ? clamp(round2(((avgRiskWeight - 1) / 1.5) * 100), 0, 100)
        : 0;

    return OptimizationScenarioSchema.parse({
        id,
        name,
        strategy,
        assumptions,
        opportunityIds: selected.map((opportunity) => opportunity.id),
        estimatedMonthlySavings,
        estimatedAnnualSavings: round2(estimatedMonthlySavings * 12),
        confidenceScore,
        riskScore,
        selectedCount: selected.length,
    });
}

export function buildScenarios(opportunities: NormalizedOpportunity[]): OptimizationScenario[] {
    return [
        buildScenario(
            "scenario-conservative",
            "Conservative Plan",
            "conservative",
            opportunities,
            0.8,
            1.3,
            8,
            ["Only high-confidence opportunities", "Low operational risk", "Minimal change volume"]
        ),
        buildScenario(
            "scenario-balanced",
            "Balanced Plan",
            "balanced",
            opportunities,
            0.65,
            1.6,
            12,
            ["Blend savings and risk", "Moderate rollout scope", "Prioritize score and confidence"]
        ),
        buildScenario(
            "scenario-aggressive",
            "Aggressive Plan",
            "aggressive",
            opportunities,
            0.45,
            2.5,
            20,
            ["Maximize potential savings", "Includes higher-risk opportunities", "Requires stronger change governance"]
        ),
    ];
}

export function computeConfidence(lookbackDays: number, usageVariance: number, type: string): number {
    let confidence = Math.min(1.0, lookbackDays / 30);
    if ((type === "reserved_instance" || type === "savings_plan") && usageVariance > 0.5) {
        confidence *= 0.5;
    }
    return Math.round(confidence * 100) / 100;
}

export function computeRiskWeight(type: string, interruptionRiskScore: number = 0): number {
    switch (type) {
        case "rightsizing":
            return 1.3;
        case "reserved_instance":
            return 1.2;
        case "savings_plan":
            return 1.1;
        case "spot_migration":
            return 1.5 + interruptionRiskScore;
        default:
            return 1.0;
    }
}

export function computeUsageVariance(cpuStdDev: number, cpuAvg: number): number {
    if (cpuAvg <= 0) return 0;
    const cv = cpuStdDev / cpuAvg;
    return Math.round(Math.min(2.0, cv) * 100) / 100;
}

export function computeScore(
    savings: number,
    confidence: number,
    riskWeight: number
): number {
    if (riskWeight <= 0) return 0;
    return Math.round(((savings * confidence) / riskWeight) * 100) / 100;
}
