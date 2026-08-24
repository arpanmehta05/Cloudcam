// AWS Compute Optimizer Provider — Fetches rightsizing recommendations
import {
    ComputeOptimizerClient,
    GetEC2InstanceRecommendationsCommand,
    InstanceRecommendation,
} from "@aws-sdk/client-compute-optimizer";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";

// ─── Types ───
export interface ComputeOptimizerRecommendation {
    instanceId: string;
    instanceName: string;
    currentType: string;
    recommendedType: string;
    finding: "OVER_PROVISIONED" | "UNDER_PROVISIONED" | "OPTIMIZED" | "NOT_OPTIMIZED";
    estimatedMonthlySavings: number;
    cpuUtilization: { avg: number; max: number; stdDev: number };
    lookbackPeriodDays: number;
    region: string;
}

// ─── Fetch recommendations for all EC2 instances (or a filtered set) ───
export async function getComputeOptimizerRecommendations(
    workspaceId: string,
    instanceIds?: string[],
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
): Promise<ComputeOptimizerRecommendation[]> {
    const clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new ComputeOptimizerClient(clientConfig);

    const command = new GetEC2InstanceRecommendationsCommand({
        instanceArns: instanceIds?.map(
            (id) => `arn:aws:ec2:${region}:*:instance/${id}`
        ),
    });

    const response = await client.send(command);
    const recommendations: ComputeOptimizerRecommendation[] = [];

    for (const rec of response.instanceRecommendations || []) {
        const parsed = parseRecommendation(rec, region);
        if (parsed) recommendations.push(parsed);
    }

    return recommendations;
}

// ─── Multi-region fetch ───
export async function getComputeOptimizerRecommendationsMultiRegion(
    workspaceId: string,
    regions: string[],
    roleArn?: string,
    externalId?: string
): Promise<ComputeOptimizerRecommendation[]> {
    const results = await Promise.allSettled(
        regions.map((r) =>
            getComputeOptimizerRecommendations(workspaceId, undefined, r, roleArn, externalId)
        )
    );

    const all: ComputeOptimizerRecommendation[] = [];
    for (const result of results) {
        if (result.status === "fulfilled") {
            all.push(...result.value);
        }
    }
    return all;
}

// ─── Helpers ───
function parseRecommendation(
    rec: InstanceRecommendation,
    region: string
): ComputeOptimizerRecommendation | null {
    if (!rec.instanceArn || !rec.finding) return null;

    const instanceId = rec.instanceArn.split("/").pop() || "";
    const instanceName = rec.instanceName || instanceId;
    const currentType = rec.currentInstanceType || "unknown";

    // Pick the best recommended option (first one ranked by Compute Optimizer)
    const topOption = rec.recommendationOptions?.[0];
    const recommendedType = topOption?.instanceType || currentType;

    // Extract estimated savings from the top recommendation
    const savingsValue =
        Number((topOption as any)?.estimatedMonthlySavings?.value) || 0;

    // Extract CPU utilization metrics from the utilization history
    const cpuMetrics = rec.utilizationMetrics?.filter(
        (m) => m.name === "Cpu"
    ) || [];

    const cpuAvg = cpuMetrics.find((m) => m.statistic === "Average");
    const cpuMax = cpuMetrics.find((m) => m.statistic === "Maximum");

    const avg = Number(cpuAvg?.value ?? 0);
    const max = Number(cpuMax?.value ?? 0);
    // Approximate stdDev from avg and max range (Compute Optimizer doesn't directly give stdDev)
    const stdDev = Math.abs(max - avg) * 0.4;

    // Determine lookback period from Compute Optimizer (default 14 days)
    const lookbackDays = rec.lookBackPeriodInDays ?? 14;

    const findingMap: Record<string, ComputeOptimizerRecommendation["finding"]> = {
        OVER_PROVISIONED: "OVER_PROVISIONED",
        UNDER_PROVISIONED: "UNDER_PROVISIONED",
        OPTIMIZED: "OPTIMIZED",
        NOT_OPTIMIZED: "NOT_OPTIMIZED",
    };

    return {
        instanceId,
        instanceName,
        currentType,
        recommendedType,
        finding: findingMap[rec.finding] || "NOT_OPTIMIZED",
        estimatedMonthlySavings: savingsValue,
        cpuUtilization: { avg, max, stdDev },
        lookbackPeriodDays: lookbackDays,
        region,
    };
}
