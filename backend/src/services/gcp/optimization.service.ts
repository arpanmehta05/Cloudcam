import { getGcpInsights } from "../../providers/gcp/insights.provider";
import { createGcpGoogleApisClient } from "../../providers/gcp/client-factory";
import { OptimizationInsight, IOptimizationInsight, PricingModelSnapshot } from "../../models/optimization-cache.model";
import { getCredentials } from "../../store/workspace-credentials";

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
    projectId?: string,
    clientEmail?: string,
    privateKey?: string,
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
            // Filter only GCP insights (GCP resourceId contains projects/ or artifactregistry. etc.)
            resourceId: { $regex: /(googleapis\.com|projects\/)/i }
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
    let pId = projectId;
    let email = clientEmail;
    let key = privateKey;

    if (!pId || !email || !key) {
        const creds = await getCredentials(userId, "gcp");
        pId = creds?.projectId;
        email = creds?.clientEmail;
        key = creds?.privateKey;
    }

    if (!pId || !email || !key) {
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

    // Purge old GCP advisor data for this user
    await OptimizationInsight.deleteMany({
        userId,
        resourceId: { $regex: /(googleapis\.com|projects\/)/i }
    });

    const rawData = await getGcpInsights(pId, email, key);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    const savedInsights: IOptimizationInsight[] = [];

    for (const rec of rawData.recommendations || []) {
        if (!rec.resourceId) continue;

        // Map categories to AWS-compatible Type
        let optType: any = "rightsizing";
        if (rec.type === "ebs") optType = "orphaned_ebs";
        else if (rec.type === "rds") optType = "orphaned_rds";

        const score = rec.impact === "high" ? 85 : rec.impact === "medium" ? 60 : 30;

        const insightData = {
            userId,
            resourceId: rec.resourceId,
            resourceName: rec.resourceId.split("/").pop() || "",
            region: "us-central1", // default/fallback
            type: optType,
            currentPricingModel: "on_demand",
            currentMonthlyCost: 100, // placeholder
            estimatedMonthlySavings: 20, // placeholder
            score,
            confidenceFactor: 0.9,
            riskWeight: 0.2,
            actionId: `gcp-${rec.type}-${rec.id}`,
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
            console.error("[GCP Optimization] Failed to save recommendation:", dbErr);
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
    projectId?: string,
    clientEmail?: string,
    privateKey?: string,
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
        let pId = projectId;
        let email = clientEmail;
        let key = privateKey;

        if (!pId || !email || !key) {
            const creds = await getCredentials(userId, "gcp");
            pId = creds?.projectId;
            email = creds?.clientEmail;
            key = creds?.privateKey;
        }

        if (!pId || !email || !key) {
            return { valid: false, reason: "GCP credentials not configured" };
        }

        const client = createGcpGoogleApisClient({ projectId: pId, clientEmail: email, privateKey: key });

        // Parse resourceName, zone/region from resourceId
        const resourceId = insight.resourceId;
        const parts = resourceId.split("/");
        
        let name = parts[parts.length - 1];
        let zone = "us-central1";
        
        const zoneIndex = parts.indexOf("zones");
        if (zoneIndex !== -1 && zoneIndex + 1 < parts.length) {
            zone = parts[zoneIndex + 1];
        } else {
            const regionIndex = parts.indexOf("locations");
            if (regionIndex !== -1 && regionIndex + 1 < parts.length) {
                zone = parts[regionIndex + 1];
            } else {
                const regionsIndex = parts.indexOf("regions");
                if (regionsIndex !== -1 && regionsIndex + 1 < parts.length) {
                    zone = parts[regionsIndex + 1];
                }
            }
        }

        const relativePath = resourceId.startsWith("//") ? resourceId.substring(2) : resourceId;
        
        try {
            if (relativePath.includes("compute.googleapis.com")) {
                if (relativePath.includes("/disks/")) {
                    await client.compute.disks.get({ project: pId, zone, disk: name });
                } else {
                    await client.compute.instances.get({ project: pId, zone, instance: name });
                }
            } else if (relativePath.includes("sqladmin.googleapis.com")) {
                await client.sqladmin.instances.get({ project: pId, instance: name });
            } else if (relativePath.includes("container.googleapis.com")) {
                const cleanPath = resourceId.substring(resourceId.indexOf("projects/"));
                await client.container.projects.locations.clusters.get({ name: cleanPath });
            } else if (relativePath.includes("run.googleapis.com")) {
                const cleanPath = resourceId.substring(resourceId.indexOf("projects/"));
                await client.run.projects.locations.services.get({ name: cleanPath });
            } else {
                let checkUrl = resourceId;
                if (!checkUrl.startsWith("http")) {
                    checkUrl = `https://${relativePath}`;
                }
                await client.auth.request({ url: checkUrl, method: "GET" });
            }
        } catch (err: any) {
            const status = err.response?.status || err.status;
            if (status === 404) {
                insight.stale = true;
                await insight.save();
                return { valid: false, reason: "GCP resource no longer exists" };
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
