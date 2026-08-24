import { getAzureInsights } from "../../providers/azure/insights.provider";
import { getAzureAccessToken } from "../../providers/azure/client-factory";
import { OptimizationInsight, IOptimizationInsight, PricingModelSnapshot } from "../../models/optimization-cache.model";
import { getCredentials } from "../../store/workspace-credentials";
import axios from "axios";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface OptimizationResult {
    insights: IOptimizationInsight[];
    opportunities: any[];
    scenarios: any[];
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
    tenantId?: string,
    subscriptionId?: string,
    clientId?: string,
    clientSecret?: string,
    forceRefresh: boolean = false
): Promise<OptimizationResult> {
    const learning = {
        calibratedActions: 0,
        totalCalibrationSamples: 0,
    };

    if (!forceRefresh) {
        const cached = await OptimizationInsight.find({
            userId,
            stale: false,
            expiresAt: { $gt: new Date() },
            // Filter only Azure insights (by resource ID format /providers/Microsoft. etc.)
            resourceId: { $regex: /^\/subscriptions/i }
        }).sort({ score: -1 });

        const pricingSnapshot = await PricingModelSnapshot.findOne({
            userId,
            expiresAt: { $gt: new Date() },
        });

        if (cached.length > 0) {
            return {
                insights: cached,
                opportunities: cached,
                scenarios: [],
                pricingBreakdown: pricingSnapshot ? {
                    breakdown: pricingSnapshot.breakdown,
                    percentages: pricingSnapshot.percentages,
                } : {
                    breakdown: { onDemand: 0, reserved: 0, spot: 0, savingsPlan: 0, other: 0, total: 0 },
                    percentages: { onDemand: 0, reserved: 0, spot: 0, savingsPlan: 0 }
                },
                totalPotentialSavings: cached.reduce((s, i) => s + i.estimatedMonthlySavings, 0),
                generatedAt: pricingSnapshot ? pricingSnapshot.generatedAt.toISOString() : new Date().toISOString(),
                fromCache: true,
                learning
            };
        }
    }

    // Load credentials if not provided
    let tId = tenantId;
    let sId = subscriptionId;
    let cId = clientId;
    let cSec = clientSecret;

    if (!tId || !sId || !cId || !cSec) {
        const creds = await getCredentials(userId, "azure");
        tId = creds?.tenantId;
        sId = creds?.subscriptionId;
        cId = creds?.clientId;
        cSec = creds?.clientSecret;
    }

    if (!tId || !sId || !cId || !cSec) {
        return {
            insights: [],
            opportunities: [],
            scenarios: [],
            pricingBreakdown: {
                breakdown: { onDemand: 0, reserved: 0, spot: 0, savingsPlan: 0, other: 0, total: 0 },
                percentages: { onDemand: 0, reserved: 0, spot: 0, savingsPlan: 0 }
            },
            totalPotentialSavings: 0,
            generatedAt: new Date().toISOString(),
            fromCache: false,
            learning
        };
    }

    // Purge old Azure advisor data for this user
    await OptimizationInsight.deleteMany({
        userId,
        resourceId: { $regex: /^\/subscriptions/i }
    });

    const rawData = await getAzureInsights(tId, sId, cId, cSec);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    const savedInsights: IOptimizationInsight[] = [];

    for (const rec of rawData.recommendations || []) {
        if (!rec.resourceId) continue;

        // Map categories to AWS-compatible Type
        let optType: any = "rightsizing";
        if (rec.category === "cost") {
            if (rec.title.toLowerCase().includes("reserved")) optType = "reserved_instance";
            else optType = "rightsizing";
        } else {
            optType = "rightsizing";
        }

        const score = rec.impact === "high" ? 85 : rec.impact === "medium" ? 60 : 30;

        const insightData = {
            userId,
            resourceId: rec.resourceId,
            resourceName: rec.resourceId.split("/").pop() || "",
            region: "eastus", // default/fallback
            type: optType,
            currentPricingModel: "on_demand",
            currentMonthlyCost: 100, // placeholder
            estimatedMonthlySavings: 20, // placeholder
            score,
            confidenceFactor: 0.9,
            riskWeight: 0.2,
            actionId: `azure-${rec.type}-${rec.id.split("/").pop()}`,
            stale: false,
            lastValidatedAt: new Date(),
            generatedAt: new Date(),
            expiresAt,
            metadata: rec
        };

        try {
            const saved = await OptimizationInsight.findOneAndUpdate(
                { userId, resourceId: rec.resourceId, type: optType },
                insightData,
                { upsert: true, new: true }
            );
            savedInsights.push(saved);
        } catch (dbErr) {
            console.error("[Azure Optimization] Failed to save recommendation:", dbErr);
        }
    }

    return {
        insights: savedInsights,
        opportunities: savedInsights,
        scenarios: [],
        pricingBreakdown: {
            breakdown: { onDemand: 0, reserved: 0, spot: 0, savingsPlan: 0, other: 0, total: 0 },
            percentages: { onDemand: 0, reserved: 0, spot: 0, savingsPlan: 0 }
        },
        totalPotentialSavings: savedInsights.reduce((s, i) => s + i.estimatedMonthlySavings, 0),
        generatedAt: new Date().toISOString(),
        fromCache: false,
        learning
    };
}

export async function validateInsight(
    insightId: string,
    userId: string,
    workspaceId: string,
    tenantId?: string,
    subscriptionId?: string,
    clientId?: string,
    clientSecret?: string,
    options?: { forceEmptyDelete?: boolean }
): Promise<{ valid: boolean; reason?: string; updatedScore?: number; warnings?: string[]; requiresForceEmptyDelete?: boolean }> {
    const insight = await OptimizationInsight.findOne({ _id: insightId, userId });
    if (!insight) return { valid: false, reason: "Insight not found" };

    if (insight.type === "savings_plan" || insight.type === "reserved_instance") {
        insight.lastValidatedAt = new Date();
        await insight.save();
        return { valid: true };
    }

    try {
        let tId = tenantId;
        let sId = subscriptionId;
        let cId = clientId;
        let cSec = clientSecret;

        if (!tId || !sId || !cId || !cSec) {
            const creds = await getCredentials(userId, "azure");
            tId = creds?.tenantId;
            sId = creds?.subscriptionId;
            cId = creds?.clientId;
            cSec = creds?.clientSecret;
        }

        if (!tId || !sId || !cId || !cSec) {
            return { valid: false, reason: "Azure credentials not configured" };
        }

        const token = await getAzureAccessToken(tId, cId, cSec);

        const lowId = (insight.resourceId || "").toLowerCase();
        let apiVersion = "2023-09-01";
        if (lowId.includes("virtualmachines")) apiVersion = "2023-09-01";
        else if (lowId.includes("storageaccounts")) apiVersion = "2023-01-01";
        else if (lowId.includes("servers/databases") || lowId.includes("servers")) apiVersion = "2021-11-01";
        else if (lowId.includes("sites")) apiVersion = "2022-03-01";
        else if (lowId.includes("containerregistry") || lowId.includes("acr")) apiVersion = "2023-07-01";
        else if (lowId.includes("documentdb") || lowId.includes("cosmosdb")) apiVersion = "2023-04-15";
        else if (lowId.includes("apimanagement") || lowId.includes("apigateway")) apiVersion = "2022-08-01";
        else if (lowId.includes("containerservice") || lowId.includes("managedclusters")) apiVersion = "2023-08-01";

        const url = `https://management.azure.com${insight.resourceId}?api-version=${apiVersion}`;
        try {
            await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err: any) {
            if (err.response?.status === 404) {
                insight.stale = true;
                await insight.save();
                return { valid: false, reason: "Azure resource no longer exists" };
            }
            throw err;
        }

        insight.lastValidatedAt = new Date();
        await insight.save();
        return { valid: true };
    } catch (err: any) {
        return { valid: false, reason: `Validation failed: ${err.message}` };
    }
}
