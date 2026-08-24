import { getComputeOptimizerRecommendationsMultiRegion } from "../../providers/compute-optimizer.provider";
import { getCostByPricingModel, getRIPurchaseRecommendation, getSavingsPlanRecommendation } from "../../providers/cost-explorer.provider";
import { discoverSpotCandidates, enrichCandidatesWithRisk } from "../../providers/spot-advisor.provider";
import { getResourceInventory } from "../../providers/resources.provider";
import { getClientConfig, DEFAULT_REGION } from "../../providers/client-factory";
import { OptimizationInsight, PricingModelSnapshot, IOptimizationInsight } from "../../models/optimization-cache.model";
import { NormalizedOpportunity, OptimizationScenario } from "../../../../models/opportunity.model";
import { AWS_DISCOVERY_REGIONS } from "../constants";

import { isBucketEmpty, regionsForOptimizationScan, mapWithConcurrency, MAX_PARALLEL_REGION_SCANS } from "./discovery";
import {
    round2,
    computeConfidence,
    computeRiskWeight,
    computeUsageVariance,
    computeScore,
    applyFeedbackCalibration,
    insightToOpportunity,
    buildScenarios,
} from "./scoring";
import { getFeedbackCalibrations } from "./enrichment";
import { CACHE_TTL_MS, validateInsight } from "./cache";

export { validateInsight };

export interface OptimizationResult {
    insights: IOptimizationInsight[];
    opportunities: NormalizedOpportunity[];
    scenarios: OptimizationScenario[];
    pricingBreakdown: any;
    totalPotentialSavings: number;
    generatedAt: string;
    fromCache: boolean;
    learning: {
        calibratedActions: number;
        totalCalibrationSamples: number;
    };
}

export async function getOptimizationInsights(
    userId: string,
    workspaceId: string,
    roleArn?: string,
    externalId?: string,
    forceRefresh: boolean = false,
    region?: string,
): Promise<OptimizationResult> {
    const isRegionalScan = !!region && region !== "all" && AWS_DISCOVERY_REGIONS.includes(region);
    const insightScopeFilter = isRegionalScan
        ? { region: { $in: [region, "global"] } }
        : {};
    const calibrationByAction = await getFeedbackCalibrations(userId);
    const learning = {
        calibratedActions: calibrationByAction.size,
        totalCalibrationSamples: Array.from(calibrationByAction.values()).reduce((sum, item) => sum + item.sampleSize, 0),
    };

    // ── 1. Check cache first ──
    if (!forceRefresh) {
        const cached = await OptimizationInsight.find({
            userId,
            stale: false,
            expiresAt: { $gt: new Date() },
            ...insightScopeFilter,
        }).sort({ score: -1 });

        const pricingSnapshot = await PricingModelSnapshot.findOne({
            userId,
            expiresAt: { $gt: new Date() },
        });

        if (cached.length > 0 && pricingSnapshot) {
            const opportunities = cached.map((insight) => insightToOpportunity(insight, calibrationByAction));
            opportunities.sort((a, b) => b.scoring.priorityScore - a.scoring.priorityScore);
            const scenarios = buildScenarios(opportunities);

            return {
                insights: cached,
                opportunities,
                scenarios,
                pricingBreakdown: {
                    breakdown: pricingSnapshot.breakdown,
                    percentages: pricingSnapshot.percentages,
                },
                totalPotentialSavings: cached.reduce((s, i) => s + i.estimatedMonthlySavings, 0),
                generatedAt: pricingSnapshot.generatedAt.toISOString(),
                fromCache: true,
                learning,
            };
        }
    }

    // ── 2. Purge old data for this user ──
    await OptimizationInsight.deleteMany({ userId, ...insightScopeFilter });
    await PricingModelSnapshot.deleteMany({ userId });

    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    const insights: Partial<IOptimizationInsight>[] = [];

    // ── 3. Fetch pricing model breakdown ──
    let pricingData: any = null;
    try {
        pricingData = await getCostByPricingModel(workspaceId, 30, roleArn, externalId);
        await PricingModelSnapshot.create({
            userId,
            breakdown: pricingData.breakdown,
            percentages: pricingData.percentages,
            generatedAt: new Date(),
            expiresAt,
        });
    } catch (err) {
        console.warn("[Optimization] Failed to fetch pricing breakdown:", err);
        pricingData = { breakdown: { onDemand: 0, reserved: 0, spot: 0, savingsPlan: 0, other: 0, total: 0 }, percentages: {} };
    }

    // ── 3.5 Deterministic pricing-mix detectors ──
    try {
        const onDemandPct = Number(pricingData?.percentages?.onDemand || 0);
        const reservedPct = Number(pricingData?.percentages?.reserved || 0);
        const onDemandSpend = Number(pricingData?.breakdown?.onDemand || 0);
        const totalSpend = Number(pricingData?.breakdown?.total || 0);

        if (totalSpend > 0 && onDemandPct >= 55 && onDemandSpend >= 100) {
            const baseSavings = round2(onDemandSpend * 0.2);
            const baseConfidence = computeConfidence(30, 0.2, "savings_plan");
            const calibrated = applyFeedbackCalibration(
                "purchase-savings-plan",
                baseSavings,
                baseConfidence,
                calibrationByAction
            );
            const riskWeight = computeRiskWeight("savings_plan");
            const score = computeScore(calibrated.savings, calibrated.confidence, riskWeight);

            insights.push({
                userId,
                resourceId: "detector-savings-plan-gap",
                resourceName: "Compute Commitment Coverage",
                region: "global",
                type: "savings_plan",
                currentPricingModel: "on_demand",
                currentMonthlyCost: onDemandSpend,
                estimatedMonthlySavings: calibrated.savings,
                score,
                confidenceFactor: calibrated.confidence,
                riskWeight,
                usageVarianceCoefficient: 0.2,
                actionId: "purchase-savings-plan",
                stale: false,
                lastValidatedAt: new Date(),
                generatedAt: new Date(),
                expiresAt,
                metadata: {
                    detector: "pricing_mix_savings_plan",
                    reasonCodes: ["high_on_demand_share", "commitment_gap"],
                    onDemandPct,
                    reservedPct,
                    onDemandSpend,
                    feedback: calibrated.feedback,
                },
            } as any);
        }

        if (totalSpend > 0 && reservedPct < 15 && onDemandSpend >= 150) {
            const baseSavings = round2(onDemandSpend * 0.15);
            const baseConfidence = computeConfidence(30, 0.35, "reserved_instance");
            const calibrated = applyFeedbackCalibration(
                "purchase-savings-plan",
                baseSavings,
                baseConfidence,
                calibrationByAction
            );
            const riskWeight = computeRiskWeight("reserved_instance");
            const score = computeScore(calibrated.savings, calibrated.confidence, riskWeight);

            insights.push({
                userId,
                resourceId: "detector-ri-coverage-gap",
                resourceName: "Reserved Capacity Coverage",
                region: "global",
                type: "reserved_instance",
                currentPricingModel: "on_demand",
                currentMonthlyCost: onDemandSpend,
                estimatedMonthlySavings: calibrated.savings,
                score,
                confidenceFactor: calibrated.confidence,
                riskWeight,
                usageVarianceCoefficient: 0.35,
                actionId: "purchase-savings-plan",
                stale: false,
                lastValidatedAt: new Date(),
                generatedAt: new Date(),
                expiresAt,
                metadata: {
                    detector: "pricing_mix_reserved_instance",
                    reasonCodes: ["low_reserved_coverage", "high_on_demand_spend"],
                    onDemandPct,
                    reservedPct,
                    onDemandSpend,
                    feedback: calibrated.feedback,
                },
            } as any);
        }
    } catch (err) {
        console.warn("[Optimization] Pricing-mix detector failed:", err);
    }

    // ── 4. Compute Optimizer — Rightsizing Recommendations ──
    try {
        const regionsToScan = regionsForOptimizationScan(region);
        const rightsizingRecs = await getComputeOptimizerRecommendationsMultiRegion(
            workspaceId, regionsToScan, roleArn, externalId
        );

        for (const rec of rightsizingRecs) {
            if (rec.finding !== "OVER_PROVISIONED" || rec.estimatedMonthlySavings <= 0) continue;

            const variance = computeUsageVariance(rec.cpuUtilization.stdDev, rec.cpuUtilization.avg);
            const baseConfidence = computeConfidence(rec.lookbackPeriodDays, variance, "rightsizing");
            const calibrated = applyFeedbackCalibration(
                "ec2-rightsize",
                rec.estimatedMonthlySavings,
                baseConfidence,
                calibrationByAction
            );
            const riskWeight = computeRiskWeight("rightsizing");
            const score = computeScore(calibrated.savings, calibrated.confidence, riskWeight);

            insights.push({
                userId,
                resourceId: rec.instanceId,
                resourceName: rec.instanceName,
                region: rec.region,
                type: "rightsizing",
                currentPricingModel: "on_demand",
                currentMonthlyCost: rec.estimatedMonthlySavings * 2, // rough estimate
                estimatedMonthlySavings: calibrated.savings,
                score,
                confidenceFactor: calibrated.confidence,
                riskWeight,
                usageVarianceCoefficient: variance,
                actionId: "ec2-rightsize",
                stale: false,
                lastValidatedAt: new Date(),
                generatedAt: new Date(),
                expiresAt,
                metadata: {
                    currentType: rec.currentType,
                    recommendedType: rec.recommendedType,
                    cpuUtilization: rec.cpuUtilization,
                    finding: rec.finding,
                    detector: "compute_optimizer_rightsizing",
                    reasonCodes: ["over_provisioned", "cpu_variance_analyzed"],
                    feedback: calibrated.feedback,
                },
            } as any);
        }
    } catch (err) {
        console.warn("[Optimization] Compute Optimizer failed:", err);
    }

    // ── 5. Spot Migration — ASG Candidates ──
    try {
        const spotRegions = regionsForOptimizationScan(region);
        const allCandidates: any[] = [];
        const spotResults = await mapWithConcurrency(spotRegions, MAX_PARALLEL_REGION_SCANS, async (r) => {
                const candidates = await discoverSpotCandidates(workspaceId, r, roleArn, externalId);
                return enrichCandidatesWithRisk(workspaceId, candidates, r, roleArn, externalId);
        });

        for (const result of spotResults) {
            if (result.status === "fulfilled") {
                allCandidates.push(...result.value);
            }
        }

        for (const candidate of allCandidates) {
            // Apply Spot eligibility rules
            if (candidate.isStateful) continue;
            if (candidate.interruptionRiskScore >= 0.4) continue;
            if (candidate.azDiversity < 2) continue;
            if (candidate.spotSavingsEstimate <= 0) continue;

            const baseConfidence = computeConfidence(30, 0, "spot_migration"); // ASGs have stable patterns
            const calibrated = applyFeedbackCalibration(
                "asg-spot-migration",
                candidate.spotSavingsEstimate,
                baseConfidence,
                calibrationByAction
            );
            const riskWeight = computeRiskWeight("spot_migration", candidate.interruptionRiskScore);
            const score = computeScore(calibrated.savings, calibrated.confidence, riskWeight);

            insights.push({
                userId,
                resourceId: candidate.resourceId,
                resourceName: candidate.resourceName,
                region: candidate.region,
                type: "spot_migration",
                currentPricingModel: "on_demand",
                currentMonthlyCost: candidate.spotSavingsEstimate / 0.6, // reverse estimate
                estimatedMonthlySavings: calibrated.savings,
                score,
                confidenceFactor: calibrated.confidence,
                riskWeight,
                usageVarianceCoefficient: 0,
                interruptionRiskScore: candidate.interruptionRiskScore,
                azDiversity: candidate.azDiversity,
                instanceFamilyFlexibility: candidate.instanceFamilyFlexibility,
                actionId: "asg-spot-migration",
                stale: false,
                lastValidatedAt: new Date(),
                generatedAt: new Date(),
                expiresAt,
                metadata: {
                    currentInstanceTypes: candidate.currentInstanceTypes,
                    isBehindLB: candidate.isBehindLB,
                    currentCapacity: candidate.currentCapacity,
                    detector: "spot_advisor_multi_az",
                    reasonCodes: ["spot_eligible", "stateless", "multi_az"],
                    feedback: calibrated.feedback,
                },
            } as any);
        }
    } catch (err) {
        console.warn("[Optimization] Spot advisor failed:", err);
    }

    // ── 6. Reserved Instance Recommendations ──
    try {
        const riData = await getRIPurchaseRecommendation(workspaceId, "Amazon Elastic Compute Cloud - Compute", roleArn, externalId);

        for (const rec of riData.recommendations) {
            if (rec.estimatedMonthlySavings <= 0) continue;

            // RI confidence depends on utilization stability
            const variance = rec.averageUtilization > 0 ? (100 - rec.averageUtilization) / 100 : 0.5;
            const baseConfidence = computeConfidence(30, variance, "reserved_instance");
            const calibrated = applyFeedbackCalibration(
                "purchase-savings-plan",
                rec.estimatedMonthlySavings,
                baseConfidence,
                calibrationByAction
            );
            const riskWeight = computeRiskWeight("reserved_instance");
            const score = computeScore(calibrated.savings, calibrated.confidence, riskWeight);

            insights.push({
                userId,
                resourceId: `ri-${rec.instanceType}-${rec.region}`,
                resourceName: `${rec.instanceType} in ${rec.region}`,
                region: rec.region,
                type: "reserved_instance",
                currentPricingModel: "on_demand",
                currentMonthlyCost: rec.estimatedMonthlyOnDemandCost,
                estimatedMonthlySavings: calibrated.savings,
                score,
                confidenceFactor: calibrated.confidence,
                riskWeight,
                usageVarianceCoefficient: variance,
                actionId: "purchase-savings-plan", // advisory action
                stale: false,
                lastValidatedAt: new Date(),
                generatedAt: new Date(),
                expiresAt,
                metadata: {
                    recommendedCount: rec.recommendedCount,
                    instanceType: rec.instanceType,
                    family: rec.family,
                    upfrontCost: rec.upfrontCost,
                    recurringMonthlyCost: rec.recurringMonthlyCost,
                    averageUtilization: rec.averageUtilization,
                    detector: "cost_explorer_ri_recommendation",
                    reasonCodes: ["ri_coverage_opportunity"],
                    feedback: calibrated.feedback,
                },
            } as any);
        }
    } catch (err) {
        console.warn("[Optimization] RI recommendation failed:", err);
    }

    // ── 7. Savings Plan Recommendations ──
    try {
        const spData = await getSavingsPlanRecommendation(workspaceId, roleArn, externalId);

        if (spData.estimatedMonthlySavings > 0) {
            const baseConfidence = computeConfidence(30, 0.1, "savings_plan");
            const calibrated = applyFeedbackCalibration(
                "purchase-savings-plan",
                spData.estimatedMonthlySavings,
                baseConfidence,
                calibrationByAction
            );
            const riskWeight = computeRiskWeight("savings_plan");
            const score = computeScore(calibrated.savings, calibrated.confidence, riskWeight);

            insights.push({
                userId,
                resourceId: "savings-plan-compute",
                resourceName: "Compute Savings Plan",
                region: "global",
                type: "savings_plan",
                currentPricingModel: "on_demand",
                currentMonthlyCost: spData.currentOnDemandSpend,
                estimatedMonthlySavings: calibrated.savings,
                score,
                confidenceFactor: calibrated.confidence,
                riskWeight,
                usageVarianceCoefficient: 0.1,
                actionId: "purchase-savings-plan",
                stale: false,
                lastValidatedAt: new Date(),
                generatedAt: new Date(),
                expiresAt,
                metadata: {
                    recommendedHourlyCommitment: spData.recommendedHourlyCommitment,
                    estimatedSavingsPercentage: spData.estimatedSavingsPercentage,
                    details: spData.details,
                    detector: "cost_explorer_savings_plan_recommendation",
                    reasonCodes: ["commitment_optimization"],
                    feedback: calibrated.feedback,
                },
            } as any);
        }
    } catch (err) {
        console.warn("[Optimization] Savings Plan recommendation failed:", err);
    }

    // ── 7.5 Orphaned Resources Finding (EBS, RDS) ──
    try {
        const inventory = await getResourceInventory(workspaceId, region || DEFAULT_REGION, roleArn, externalId);
        
        // Unattached EBS Volumes
        const unattachedEbs = (inventory.ebs || []).filter((vol: any) => vol.state === "available");
        for (const vol of unattachedEbs) {
            const baseSavings = (vol.size || 0) * 0.08; // Roughly $0.08/GB for gp3
            const calibrated = applyFeedbackCalibration(
                "ebs-delete",
                baseSavings,
                0.9,
                calibrationByAction
            );
            insights.push({
                userId,
                resourceId: vol.id,
                resourceName: vol.name || vol.id,
                region: vol.region,
                type: "orphaned_ebs" as any,
                currentPricingModel: "on_demand",
                currentMonthlyCost: baseSavings,
                estimatedMonthlySavings: calibrated.savings,
                score: computeScore(calibrated.savings, calibrated.confidence, 1.0),
                confidenceFactor: calibrated.confidence,
                riskWeight: 1.0,
                usageVarianceCoefficient: 0,
                actionId: "ebs-delete",
                stale: false,
                lastValidatedAt: new Date(),
                generatedAt: new Date(),
                expiresAt,
                metadata: {
                    size: vol.size,
                    volumeType: vol.type,
                    detector: "inventory_unattached_ebs",
                    reasonCodes: ["ebs_unattached"],
                    feedback: calibrated.feedback,
                }
            } as any);
        }

        // Stale RDS Snapshots
        const orphanedSnaps = (inventory.rds || []).filter((r: any) => r.type === "snapshot");
        for (const snap of orphanedSnaps) {
            const baseSavings = (snap.allocatedStorage || 0) * 0.095; // Rough backup cost
            // Flag snapshots older than 30 days
            const ageDays = snap.snapshotCreateTime ? (new Date().getTime() - new Date(snap.snapshotCreateTime).getTime()) / (1000 * 60 * 60 * 24) : 31;
            if (ageDays > 30) {
                const calibrated = applyFeedbackCalibration(
                    "rds-delete-snapshot",
                    baseSavings,
                    0.9,
                    calibrationByAction
                );
                insights.push({
                    userId,
                    resourceId: snap.id,
                    resourceName: snap.id,
                    region: snap.region,
                    type: "orphaned_rds" as any,
                    currentPricingModel: "on_demand",
                    currentMonthlyCost: baseSavings,
                    estimatedMonthlySavings: calibrated.savings,
                    score: computeScore(calibrated.savings, calibrated.confidence, 1.0),
                    confidenceFactor: calibrated.confidence,
                    riskWeight: 1.0,
                    usageVarianceCoefficient: 0,
                    actionId: "rds-delete-snapshot",
                    stale: false,
                    lastValidatedAt: new Date(),
                    generatedAt: new Date(),
                    expiresAt,
                    metadata: {
                        ageDays: Math.round(ageDays),
                        engine: snap.engine,
                        status: snap.status,
                        detector: "inventory_stale_rds_snapshot",
                        reasonCodes: ["snapshot_age_gt_30d"],
                        feedback: calibrated.feedback,
                    }
                } as any);
            }
        }

        // Orphaned (Old or Empty) S3 Buckets heuristic
        const clientConfig = await getClientConfig(workspaceId, region || DEFAULT_REGION, roleArn, externalId);

        for (const bucket of (inventory.s3 || [])) {
            const ageDays = bucket.creationDate ? (new Date().getTime() - new Date(bucket.creationDate).getTime()) / (1000 * 60 * 60 * 24) : 0;
            const isEmpty = await isBucketEmpty(clientConfig, bucket.name);

            if (ageDays > 365 || isEmpty) {
                const baseSavings = 0.5;
                const calibrated = applyFeedbackCalibration(
                    "s3-delete-bucket",
                    baseSavings,
                    0.5,
                    calibrationByAction
                );
                
                const reasonCodes = ageDays > 365 ? ["bucket_age_gt_365d"] : ["bucket_empty"];
                const detectorName = ageDays > 365 ? "inventory_old_s3_bucket" : "inventory_empty_s3_bucket";

                insights.push({
                    userId,
                    resourceId: bucket.name,
                    resourceName: bucket.name,
                    region: bucket.region || "us-east-1",
                    type: "orphaned_s3" as any,
                    currentPricingModel: "on_demand",
                    currentMonthlyCost: baseSavings, // Placeholder until bucket-size telemetry is added
                    estimatedMonthlySavings: calibrated.savings,
                    score: computeScore(calibrated.savings, calibrated.confidence, 1.5),
                    confidenceFactor: calibrated.confidence,
                    riskWeight: 1.5,
                    usageVarianceCoefficient: 0,
                    actionId: "s3-delete-bucket",
                    stale: false,
                    lastValidatedAt: new Date(),
                    generatedAt: new Date(),
                    expiresAt,
                    metadata: {
                        ageDays: Math.round(ageDays),
                        detector: detectorName,
                        reasonCodes,
                        isEmpty,
                        feedback: calibrated.feedback,
                    }
                } as any);
            }
        }
    } catch (err) {
        console.warn("[Optimization] Orphaned resource finding failed:", err);
    }

    // ── 8. Persist with deduplication ──
    const savedInsights: IOptimizationInsight[] = [];
    for (const insight of insights) {
        try {
            const saved = await OptimizationInsight.findOneAndUpdate(
                { userId, resourceId: insight.resourceId, type: insight.type },
                insight,
                { upsert: true, returnDocument: "after" }
            );
            if (saved) {
                savedInsights.push(saved);
            }
        } catch (err) {
            console.warn(`[Optimization] Failed to save insight for ${insight.resourceId}:`, err);
        }
    }

    // Sort by score descending
    savedInsights.sort((a, b) => b.score - a.score);

    const opportunities = savedInsights.map((insight) => insightToOpportunity(insight, calibrationByAction));
    opportunities.sort((a, b) => b.scoring.priorityScore - a.scoring.priorityScore);
    const scenarios = buildScenarios(opportunities);

    return {
        insights: savedInsights,
        opportunities,
        scenarios,
        pricingBreakdown: pricingData,
        totalPotentialSavings: savedInsights.reduce((s, i) => s + i.estimatedMonthlySavings, 0),
        generatedAt: new Date().toISOString(),
        fromCache: false,
        learning,
    };
}
