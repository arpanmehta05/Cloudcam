// AWS Optimization & Intelligence Helpers
import { ComputeOptimizerClient, GetEC2InstanceRecommendationsCommand } from "@aws-sdk/client-compute-optimizer";
import { SupportClient, DescribeTrustedAdvisorChecksCommand } from "@aws-sdk/client-support";
import { getClientConfig, DEFAULT_REGION, SUPPORT_REGION } from "./client-factory";

export async function getOptimizationRecommendations(
    workspaceId: string,
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
) {
    const config = await getClientConfig(workspaceId, region, roleArn, externalId);

    // Compute Optimizer (Regional)
    const coClient = new ComputeOptimizerClient(config);

    // Trusted Advisor requires Business/Enterprise Support and uses us-east-1
    const supportConfig = await getClientConfig(workspaceId, SUPPORT_REGION, roleArn, externalId);
    const supportClient = new SupportClient(supportConfig);

    const results: any = {
        computeRecommendations: [],
        trustedAdvisor: {
            security: 0,
            cost: 0,
            performance: 0
        }
    };

    // 1. Fetch Compute Optimizer recommendations
    try {
        const recommendations: any = await coClient.send(new GetEC2InstanceRecommendationsCommand({}));
        results.computeRecommendations = (recommendations.instanceRecommendations || []).map((rec: any) => ({
            instanceId: rec.instanceId,
            currentType: rec.currentInstanceType,
            finding: rec.finding, // OVER_PROVISIONED, UNDER_PROVISIONED, OPTIMIZED
            recommendations: (rec.recommendationOptions || []).map((opt: any) => ({
                type: opt.instanceType,
                savings: opt.performanceRisk // Simplified for now
            }))
        }));
    } catch (e) {
        console.log("Compute Optimizer not enabled or no data");
    }

    // 2. Fetch Trusted Advisor (if accessible)
    try {
        const checks = await supportClient.send(new DescribeTrustedAdvisorChecksCommand({ language: "en" }));
        // Logic to categorize and count check categories
        results.trustedAdvisor.status = "Linked";
    } catch (e) {
        results.trustedAdvisor.status = "Requires Business Support Plan";
    }

    return results;
}
