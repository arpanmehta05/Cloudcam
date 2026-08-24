// AWS Spot Advisor Provider — Analyzes Spot Instance viability and risk
import {
    EC2Client,
    DescribeSpotPriceHistoryCommand,
} from "@aws-sdk/client-ec2";
import { AutoScalingClient, DescribeAutoScalingGroupsCommand as ASGDescribeCommand } from "@aws-sdk/client-auto-scaling";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";

// ─── Types ───
export interface SpotCandidate {
    resourceId: string;              // ASG name or instance ID
    resourceName: string;
    resourceType: "asg" | "instance";
    region: string;
    currentInstanceTypes: string[];
    spotSavingsEstimate: number;     // estimated monthly savings
    interruptionRiskScore: number;   // 0.0 (safe) to 1.0 (risky)
    azDiversity: number;             // number of AZs in ASG
    instanceFamilyFlexibility: number; // how many compatible types exist
    isStateful: boolean;
    isBehindLB: boolean;
    currentCapacity: number;
}

export interface SpotPriceAnalysis {
    instanceType: string;
    region: string;
    avgPrice: number;
    maxPrice: number;
    minPrice: number;
    priceVariance: number;           // standard deviation
    onDemandPrice: number;
    savingsPercent: number;
    interruptionRiskScore: number;   // derived from variance
}

function awsErrorCode(error: any): string {
    return String(error?.name || error?.Code || error?.code || error?.Error?.Code || "");
}

function isExpectedAwsAccessError(error: any): boolean {
    return [
        "InvalidClientTokenId",
        "ExpiredToken",
        "UnrecognizedClientException",
        "AccessDenied",
        "AccessDeniedException",
        "UnauthorizedOperation",
    ].includes(awsErrorCode(error));
}

function logAwsProviderSkip(scope: string, region: string, error: any) {
    const code = awsErrorCode(error) || "AwsProviderError";
    const message = String(error?.message || error?.Error?.Message || "AWS request failed");
    if (isExpectedAwsAccessError(error)) {
        console.warn(`[SpotAdvisor] Skipping ${scope} in ${region}: ${code} - ${message}`);
        return;
    }
    console.warn(`[SpotAdvisor] Failed ${scope} in ${region}:`, error);
}

// ─── Spot Price History Analysis ───
export async function analyzeSpotPrices(
    workspaceId: string,
    instanceTypes: string[],
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
): Promise<SpotPriceAnalysis[]> {
    const clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    const ec2 = new EC2Client(clientConfig);

    // Fetch 7 days of Spot price history
    const endTime = new Date();
    const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const analyses: SpotPriceAnalysis[] = [];

    for (const instanceType of instanceTypes) {
        try {
            const prices: number[] = [];
            let nextToken: string | undefined;

            do {
                const response = await ec2.send(
                    new DescribeSpotPriceHistoryCommand({
                        InstanceTypes: [instanceType as any],
                        ProductDescriptions: ["Linux/UNIX"],
                        StartTime: startTime,
                        EndTime: endTime,
                        NextToken: nextToken,
                        MaxResults: 1000,
                    })
                );

                for (const entry of response.SpotPriceHistory || []) {
                    if (entry.SpotPrice) {
                        prices.push(parseFloat(entry.SpotPrice));
                    }
                }
                nextToken = response.NextToken;
            } while (nextToken);

            if (prices.length === 0) continue;

            const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
            const max = Math.max(...prices);
            const min = Math.min(...prices);
            const variance = Math.sqrt(
                prices.reduce((s, p) => s + (p - avg) ** 2, 0) / prices.length
            );

            // Estimate On-Demand price as ~3x the average Spot price (rough heuristic)
            // In production, you'd use the AWS Pricing API for exact On-Demand rates
            const onDemandEstimate = avg * 3;
            const savingsPercent = ((onDemandEstimate - avg) / onDemandEstimate) * 100;

            // Interruption risk: normalize variance relative to average price
            // Higher coefficient of variation = higher interruption risk
            const coefficientOfVariation = avg > 0 ? variance / avg : 0;
            const interruptionRiskScore = Math.min(1.0, coefficientOfVariation * 2);

            analyses.push({
                instanceType,
                region,
                avgPrice: Math.round(avg * 10000) / 10000,
                maxPrice: Math.round(max * 10000) / 10000,
                minPrice: Math.round(min * 10000) / 10000,
                priceVariance: Math.round(variance * 10000) / 10000,
                onDemandPrice: Math.round(onDemandEstimate * 10000) / 10000,
                savingsPercent: Math.round(savingsPercent * 100) / 100,
                interruptionRiskScore: Math.round(interruptionRiskScore * 100) / 100,
            });
        } catch (err) {
            logAwsProviderSkip(`spot price analysis for ${instanceType}`, region, err);
        }
    }

    return analyses;
}

// ─── Discover Spot-Eligible ASGs ───
export async function discoverSpotCandidates(
    workspaceId: string,
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
): Promise<SpotCandidate[]> {
    let clientConfig: any;
    try {
        clientConfig = await getClientConfig(workspaceId, region, roleArn, externalId);
    } catch {
        return [];
    }

    const candidates: SpotCandidate[] = [];

    try {
        // We need the Auto Scaling client, not EC2, for DescribeAutoScalingGroups
        const asgClient = new AutoScalingClient(clientConfig);
        let nextToken: string | undefined;

        do {
            const response = await asgClient.send(
                new ASGDescribeCommand({ NextToken: nextToken })
            );

            for (const asg of response.AutoScalingGroups || []) {
                if (!asg.AutoScalingGroupName) continue;

                const azDiversity = asg.AvailabilityZones?.length || 1;
                const currentTypes = new Set<string>();

                // Get instance types from launch template/config
                if (asg.MixedInstancesPolicy?.LaunchTemplate?.Overrides) {
                    for (const override of asg.MixedInstancesPolicy.LaunchTemplate.Overrides) {
                        if (override.InstanceType) currentTypes.add(override.InstanceType);
                    }
                }

                // Check if already using Spot
                const existingSpotPercent =
                    asg.MixedInstancesPolicy?.InstancesDistribution
                        ?.SpotAllocationStrategy
                        ? (asg.MixedInstancesPolicy.InstancesDistribution
                            .OnDemandPercentageAboveBaseCapacity ?? 100)
                        : 100;
                const isAlreadySpot = existingSpotPercent < 50;

                // Determine statefulness heuristic
                // ASGs are generally stateless, but check tags
                const statefulTag = asg.Tags?.find(
                    (t) =>
                        t.Key?.toLowerCase() === "stateful" &&
                        t.Value?.toLowerCase() === "true"
                );
                const isStateful = !!statefulTag;

                // Check if behind a load balancer
                const isBehindLB =
                    (asg.TargetGroupARNs?.length || 0) > 0 ||
                    (asg.LoadBalancerNames?.length || 0) > 0;

                // Instance family flexibility — how many types are compatible
                const instanceFamilyFlexibility = Math.max(1, currentTypes.size);

                // Estimate savings (rough: 60% of current capacity cost if migrated to Spot)
                const capacity = asg.DesiredCapacity || 0;
                // Very rough estimate: $0.05/hr per instance average → $36/mo per instance
                const estimatedCurrentMonthlyCost = capacity * 36;
                const spotSavingsEstimate = isAlreadySpot
                    ? 0
                    : estimatedCurrentMonthlyCost * 0.6;

                if (!isAlreadySpot && !isStateful && capacity > 0) {
                    candidates.push({
                        resourceId: asg.AutoScalingGroupName,
                        resourceName: asg.AutoScalingGroupName,
                        resourceType: "asg",
                        region,
                        currentInstanceTypes: Array.from(currentTypes),
                        spotSavingsEstimate: Math.round(spotSavingsEstimate * 100) / 100,
                        interruptionRiskScore: 0, // will be filled by spot price analysis
                        azDiversity,
                        instanceFamilyFlexibility,
                        isStateful,
                        isBehindLB,
                        currentCapacity: capacity,
                    });
                }
            }

            nextToken = response.NextToken;
        } while (nextToken);
    } catch (err) {
        logAwsProviderSkip("ASG discovery", region, err);
    }

    return candidates;
}

// ─── Enrich candidates with Spot price risk scores ───
export async function enrichCandidatesWithRisk(
    workspaceId: string,
    candidates: SpotCandidate[],
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
): Promise<SpotCandidate[]> {
    // Collect all unique instance types
    const allTypes = new Set<string>();
    for (const c of candidates) {
        for (const t of c.currentInstanceTypes) allTypes.add(t);
    }

    if (allTypes.size === 0) return candidates;

    // Get spot price analyses
    const analyses = await analyzeSpotPrices(
        workspaceId,
        Array.from(allTypes),
        region,
        roleArn,
        externalId
    );

    const riskMap = new Map<string, number>();
    for (const a of analyses) {
        riskMap.set(a.instanceType, a.interruptionRiskScore);
    }

    // Assign the worst-case risk across all instance types in each candidate
    return candidates.map((c) => {
        const risks = c.currentInstanceTypes
            .map((t) => riskMap.get(t) ?? 0.5) // default to medium risk if unknown
            .filter((r) => r > 0);

        return {
            ...c,
            interruptionRiskScore:
                risks.length > 0
                    ? Math.round(Math.max(...risks) * 100) / 100
                    : 0.5,
        };
    });
}
