import { createGcpGoogleApisClient } from "./client-factory";

export interface GcpInsight {
    id: string;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    category: "cost" | "security" | "performance" | "faultTolerance";
    savingsPercentage: number;
    type: string; // ec2, rds, s3, etc.
    resourceId?: string;
    source: string;
}

export interface AdvisorSummary {
    categories: {
        cost: number;
        security: number;
        performance: number;
        faultTolerance: number;
    };
}

export async function getGcpInsights(
    projectId: string,
    clientEmail: string,
    privateKey: string
): Promise<{
    recommendations: GcpInsight[];
    trustedAdvisor: AdvisorSummary;
    setupRequired?: boolean;
    warning?: string;
    error?: boolean;
}> {
    if (!projectId || !clientEmail || !privateKey) {
        return {
            recommendations: [],
            trustedAdvisor: {
                categories: { cost: 0, security: 0, performance: 0, faultTolerance: 0 }
            },
            setupRequired: true,
            warning: "GCP Insights integration is not configured. Please configure service account credentials in Settings."
        };
    }

    const client = createGcpGoogleApisClient({ projectId, clientEmail, privateKey });

    const recommenders = [
        "google.compute.instance.MachineTypeRecommender",
        "google.compute.disk.IdleResourceRecommender",
        "google.cloudsql.instance.IdleRecommender"
    ];
    const locations = ["global", "us-central1", "us-east1"];

    try {
        const promises: Promise<any>[] = [];
        for (const recommenderId of recommenders) {
            for (const location of locations) {
                promises.push(
                    client.recommender.projects.locations.recommenders.recommendations.list({
                        parent: `projects/${projectId}/locations/${location}/recommenders/${recommenderId}`
                    }).then((res: any) => ({
                        recommenderId,
                        location,
                        recommendations: res.data.recommendations || []
                    })).catch((err: any) => {
                        console.warn(`[getGcpInsights] Recommender ${recommenderId} in ${location} failed:`, err.message);
                        return { recommenderId, location, recommendations: [], error: err.message };
                    })
                );
            }
        }

        const results = await Promise.all(promises);
        const recommendations: GcpInsight[] = [];
        const queryErrors: string[] = [];

        for (const res of results) {
            if (res.error) {
                queryErrors.push(`${res.recommenderId.split('.').pop()} at ${res.location}: ${res.error}`);
            }
            for (const rec of res.recommendations) {
                const id = rec.name?.split("/").pop() || `rec-${Math.random()}`;
                const title = rec.description || "GCP Recommendation";

                // Map category
                const gcpCat = rec.primaryImpact?.category;
                let category: "cost" | "security" | "performance" | "faultTolerance" = "cost";
                if (gcpCat === "SECURITY") category = "security";
                else if (gcpCat === "PERFORMANCE") category = "performance";
                else if (gcpCat === "MANAGEABILITY" || gcpCat === "RELIABILITY") category = "faultTolerance";

                // Map impact / priority
                let impact: "high" | "medium" | "low" = "medium";
                if (rec.priority) {
                    const prio = rec.priority.toLowerCase();
                    if (prio === "high" || prio === "highest" || prio === "p0" || prio === "p1") impact = "high";
                    else if (prio === "low" || prio === "lowest" || prio === "p3" || prio === "p4") impact = "low";
                }

                // Find resourceId in associatedResources
                const resourceId = rec.associatedResources?.[0] || undefined;

                // Map service type for frontend
                let type = "ec2";
                if (res.recommenderId.includes("disk")) type = "ebs";
                else if (res.recommenderId.includes("sql")) type = "rds";

                // Parity mappings for GCP
                const resLow = (resourceId || "").toLowerCase();
                const recLow = res.recommenderId.toLowerCase();
                if (resLow.includes("container.googleapis.com") || recLow.includes("gke")) type = "eks";
                else if (resLow.includes("run.googleapis.com") || recLow.includes("run")) type = "ecs";
                else if (resLow.includes("apigateway.googleapis.com") || recLow.includes("apigateway")) type = "apigateway";
                else if (resLow.includes("firestore.googleapis.com") || resLow.includes("datastore.googleapis.com") || recLow.includes("firestore")) type = "dynamodb";
                else if (resLow.includes("artifactregistry.googleapis.com") || recLow.includes("artifactregistry")) type = "ecr";

                recommendations.push({
                    id,
                    title,
                    description: rec.description || `GCP optimization action.`,
                    impact,
                    category,
                    savingsPercentage: 0,
                    type,
                    resourceId,
                    source: "gcp-recommender"
                });
            }
        }

        const categories = {
            cost: recommendations.filter(r => r.category === "cost").length,
            security: recommendations.filter(r => r.category === "security").length,
            performance: recommendations.filter(r => r.category === "performance").length,
            faultTolerance: recommendations.filter(r => r.category === "faultTolerance").length
        };

        const allFailed = queryErrors.length === recommenders.length * locations.length;

        return {
            recommendations,
            trustedAdvisor: { categories },
            warning: queryErrors.length > 0 ? `GCP Recommender API queries failed: ${queryErrors.join("; ")}` : undefined,
            error: allFailed ? true : undefined
        };
    } catch (error: any) {
        console.error("[getGcpInsights] Recommender API query failed:", error.message);
        return {
            recommendations: [],
            trustedAdvisor: {
                categories: { cost: 0, security: 0, performance: 0, faultTolerance: 0 }
            },
            error: true,
            warning: `GCP Recommender query failed: ${error.message}. Please verify Recommender API is enabled and service account has Recommender Viewer role.`
        };
    }
}
