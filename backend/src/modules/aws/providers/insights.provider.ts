// AWS Compute Optimizer + Trusted Advisor Provider
import {
    ComputeOptimizerClient,
    GetEC2InstanceRecommendationsCommand,
    GetLambdaFunctionRecommendationsCommand,
    GetEBSVolumeRecommendationsCommand,
    GetECSServiceRecommendationsCommand
} from "@aws-sdk/client-compute-optimizer";
import { SupportClient, DescribeTrustedAdvisorChecksCommand } from "@aws-sdk/client-support";
import { getClientConfig, DEFAULT_REGION, SUPPORT_REGION } from "./client-factory";

function savingsPercentageFromOpportunity(value: unknown): number {
    const percentage = Number((value as any)?.savingsOpportunityPercentage);
    return Number.isFinite(percentage) && percentage > 0 ? percentage : 0;
}

export async function getOptimizationRecommendations(workspaceId: string, region: string = DEFAULT_REGION, roleArn?: string, externalId?: string) {
    const config = await getClientConfig(workspaceId, region, roleArn, externalId);
    const coClient = new ComputeOptimizerClient(config);

    const supportConfig = await getClientConfig(workspaceId, SUPPORT_REGION, roleArn, externalId);
    const supportClient = new SupportClient(supportConfig);

    const results: any = {
        computeRecommendations: [],
        lambdaRecommendations: [],
        ebsRecommendations: [],
        ecsRecommendations: [],
        trustedAdvisor: { security: 0, cost: 0, performance: 0, status: "Unknown" }
    };

    // 1. EC2 Recommendations
    try {
        const recommendations: any = await coClient.send(new GetEC2InstanceRecommendationsCommand({}));
        results.computeRecommendations = (recommendations.instanceRecommendations || []).map((rec: any) => ({
            resourceId: rec.instanceId,
            type: "ec2",
            finding: rec.finding,
            currentType: rec.currentInstanceType,
            recommendationOptions: (rec.recommendationOptions || []).map((opt: any) => ({
                targetType: opt.instanceType,
                savingsPercentage: savingsPercentageFromOpportunity(opt.savingsOpportunity)
            }))
        }));
    } catch { console.log("Compute Optimizer: EC2 recommendations not available"); }

    // 2. Lambda Recommendations
    try {
        const lambdaRecs: any = await coClient.send(new GetLambdaFunctionRecommendationsCommand({}));
        results.lambdaRecommendations = (lambdaRecs.lambdaFunctionRecommendations || []).map((rec: any) => ({
            resourceId: rec.functionArn?.split(":").pop(),
            type: "lambda",
            finding: rec.finding,
            currentMemory: rec.currentMemorySize,
            recommendationOptions: (rec.memorySizeRecommendationOptions || []).map((opt: any) => ({
                targetMemory: opt.memorySize,
                savingsPercentage: savingsPercentageFromOpportunity(opt.savingsOpportunity)
            }))
        }));
    } catch { console.log("Compute Optimizer: Lambda recommendations not available"); }

    // 3. EBS Recommendations
    try {
        const ebsRecs: any = await coClient.send(new GetEBSVolumeRecommendationsCommand({}));
        results.ebsRecommendations = (ebsRecs.ebsVolumeRecommendations || []).map((rec: any) => ({
            resourceId: rec.volumeArn?.split("/").pop(),
            type: "ebs",
            finding: rec.finding,
            currentType: rec.currentConfiguration?.volumeType,
            recommendationOptions: (rec.volumeRecommendationOptions || []).map((opt: any) => ({
                targetType: opt.configuration?.volumeType,
                savingsPercentage: savingsPercentageFromOpportunity(opt.savingsOpportunity)
            }))
        }));
    } catch { console.log("Compute Optimizer: EBS recommendations not available"); }

    // 4. ECS Recommendations
    try {
        const ecsRecs: any = await coClient.send(new GetECSServiceRecommendationsCommand({}));
        results.ecsRecommendations = (ecsRecs.ecsServiceRecommendations || []).map((rec: any) => ({
            resourceId: rec.serviceArn?.split("/").pop(),
            type: "ecs",
            finding: rec.finding,
            currentCpu: rec.currentServiceConfiguration?.cpu,
            currentMemory: rec.currentServiceConfiguration?.memory,
            recommendationOptions: (rec.serviceRecommendationOptions || []).map((opt: any) => ({
                targetCpu: opt.containerRecommendations?.[0]?.cpu,
                targetMemory: opt.containerRecommendations?.[0]?.memory,
                savingsPercentage: savingsPercentageFromOpportunity(opt.savingsOpportunity)
            }))
        }));
    } catch { console.log("Compute Optimizer: ECS recommendations not available"); }

    // 5. Trusted Advisor
    try {
        await supportClient.send(new DescribeTrustedAdvisorChecksCommand({ language: "en" }));
        results.trustedAdvisor.status = "Linked";
    } catch { results.trustedAdvisor.status = "Requires Business Support Plan"; }

    return results;
}
