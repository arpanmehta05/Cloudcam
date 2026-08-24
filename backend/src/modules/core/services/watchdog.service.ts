// Watchdog Service — dashboard data aggregation via Direct AWS SDK
import { fetchMetrics, calculateMetricStats } from "../../../providers/aws/cloudwatch.provider";
import { getBillingData } from "../../../services/aws/billing.service";
import { getResourceInventory } from "../../../providers/aws/resources.provider";

function formatTimeSeriesForChart(datapoints: any[], valueKey: string = "value") {
    if (!datapoints.length) return [];

    // We want roughly 12 points for the chart
    const step = Math.max(1, Math.floor(datapoints.length / 12));
    const result: any[] = [];

    for (let i = 0; i < datapoints.length; i += step) {
        const date = new Date(datapoints[i].timestamp);
        result.push({
            time: `${date.getHours()}:00`,
            [valueKey]: datapoints[i].value
        });
    }
    return result.slice(-12);
}

function getServiceColor(serviceName: string): string {
    const colors: Record<string, string> = {
        EC2: "#3b82f6", AmazonEC2: "#3b82f6", "Amazon Elastic Compute Cloud - Compute": "#3b82f6",
        RDS: "#8b5cf6", AmazonRDS: "#8b5cf6", "Amazon Relational Database Service": "#8b5cf6",
        S3: "#22c55e", AmazonS3: "#22c55e", "Amazon Simple Storage Service": "#22c55e",
        Lambda: "#f59e0b", AWSLambda: "#f59e0b", "AWS Lambda": "#f59e0b",
        CloudFront: "#ec4899", AmazonCloudFront: "#ec4899", "Amazon CloudFront": "#ec4899",
        APIGateway: "#06b6d4", AmazonApiGateway: "#06b6d4", "Amazon API Gateway": "#06b6d4"
    };
    return colors[serviceName] || "#6b7280";
}

export async function getWatchdogData(timeRange: string, workspaceId: string, roleArn?: string, externalId?: string) {
    try {
        // 1. Define Queries
        const computeQueries = [
            { namespace: "AWS/EC2", metricName: "CPUUtilization", stat: "Average" },
            { namespace: "AWS/Lambda", metricName: "Errors", stat: "Sum" },
            { namespace: "AWS/Lambda", metricName: "Invocations", stat: "Sum" },
            { namespace: "AWS/Lambda", metricName: "Duration", stat: "Average" }
        ];

        // 2. Fetch Everything in Parallel
        const [billingSettled, cpuSettled, lErrorsSettled, lInvocationsSettled, lDurationSettled, inventorySettled] = await Promise.allSettled([
            getBillingData(workspaceId, roleArn, externalId),
            fetchMetrics(workspaceId, [computeQueries[0]], timeRange, undefined, roleArn, externalId),
            fetchMetrics(workspaceId, [computeQueries[1]], timeRange, undefined, roleArn, externalId),
            fetchMetrics(workspaceId, [computeQueries[2]], timeRange, undefined, roleArn, externalId),
            fetchMetrics(workspaceId, [computeQueries[3]], timeRange, undefined, roleArn, externalId),
            getResourceInventory(workspaceId, undefined, roleArn, externalId)
        ]);

        const billingData = billingSettled.status === "fulfilled" ? billingSettled.value : {
            summary: { currentSpend: 0, unit: "USD", forecast: null, projectedTotal: 0 },
            mtdBreakdown: [],
            history: []
        };
        const cpuRes = cpuSettled.status === "fulfilled" ? cpuSettled.value : [];
        const lambdaErrorsRes = lErrorsSettled.status === "fulfilled" ? lErrorsSettled.value : [];
        const lambdaInvocationsRes = lInvocationsSettled.status === "fulfilled" ? lInvocationsSettled.value : [];
        const lambdaDurationRes = lDurationSettled.status === "fulfilled" ? lDurationSettled.value : [];
        const inventory = inventorySettled.status === "fulfilled" ? inventorySettled.value : {
            ec2: [], lambda: [], rds: [], s3: [], ecs: [], amplify: [], dynamodb: [], sqs: [], alb: [], alerts: [],
            counts: { ec2: 0, lambda: 0, rds: 0, s3: 0, ecs: 0, amplify: 0, dynamodb: 0, sqs: 0, alb: 0, alerts: 0, total: 0 }
        };

        const mtdSpend = billingData.summary.currentSpend;
        const byService = (billingData.mtdBreakdown || []).map(b => ({
            name: b.service,
            cost: b.amount,
            color: getServiceColor(b.service)
        })).sort((a, b) => b.cost - a.cost).slice(0, 6);

        // CPU
        const cpuStats = calculateMetricStats(cpuRes[0]?.datapoints || []);
        const avgCpu = cpuStats.avg;
        const cpuTrend = cpuStats.trend === "increasing" ? "up" : cpuStats.trend === "decreasing" ? "down" : "stable";
        const cpuHistory = formatTimeSeriesForChart(cpuRes[0]?.datapoints || [], "value");

        // Lambda
        const lambdaErrors = (lambdaErrorsRes[0]?.datapoints || []).reduce((sum, p) => sum + p.value, 0);
        const lambdaInvocations = (lambdaInvocationsRes[0]?.datapoints || []).reduce((sum, p) => sum + p.value, 0);
        const lambdaDurationStats = calculateMetricStats(lambdaDurationRes[0]?.datapoints || []);

        // Format lambda history (combining invocations and errors from real data)
        const lambdaHistory = (lambdaInvocationsRes[0]?.datapoints || []).map((p, i) => {
            const date = new Date(p.timestamp);
            return {
                time: `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`,
                invocations: p.value,
                errors: lambdaErrorsRes[0]?.datapoints[i]?.value || 0,
                duration: lambdaDurationRes[0]?.datapoints[i]?.value || 0
            };
        }).slice(-12);

        // Daily spend from real Cost Explorer history
        const dailySpend = (billingData.history || []).map(day => ({
            date: day.date,
            amount: day.amount
        })).slice(-15);

        // Real health checks based on which services actually responded
        const targets: { name: string; status: "up" | "down"; job: string }[] = [];
        if (cpuRes[0]) targets.push({ name: "CloudWatch Metrics", status: "up", job: "aws-cloudwatch" });
        else targets.push({ name: "CloudWatch Metrics", status: "down", job: "aws-cloudwatch" });
        if (billingData.summary.currentSpend !== undefined) targets.push({ name: "Cost Explorer", status: "up", job: "aws-ce" });
        else targets.push({ name: "Cost Explorer", status: "down", job: "aws-ce" });
        if (inventory.counts.total >= 0) targets.push({ name: "Resource Inventory", status: "up", job: "aws-resources" });

        const totalUp = targets.filter(t => t.status === "up").length;

        // EC2 Instance list from real inventory
        const ec2Instances = (inventory.ec2 || []).map(inst => ({
            id: inst.id,
            name: inst.name || inst.id,
            state: inst.state,
            type: inst.type,
            launchTime: inst.launchTime
        }));

        return {
            success: true,
            data: {
                overview: {
                    mtdSpend,
                    avgCpu,
                    cpuTrend,
                    targetsUp: totalUp,
                    targetsTotal: targets.length,
                    lambdaErrors,
                    lambdaInvocations,
                    cpuHistory,
                    lambdaHistory
                },
                cost: {
                    dailySpend,
                    byService,
                    forecast: billingData.summary.forecast,
                    currentSpend: mtdSpend
                },
                compute: {
                    ec2Instances,
                    lambda: {
                        history: lambdaHistory,
                        errorRate: lambdaInvocations > 0 ? (lambdaErrors / lambdaInvocations) * 100 : 0,
                        avgDuration: lambdaDurationStats.avg,
                        totalInvocations: lambdaInvocations,
                        concurrent: inventory.lambda.length
                    }
                },
                resources: {
                    counts: inventory.counts
                },
                healthAlerts: {
                    targets,
                    alerts: [],
                    totalUp,
                    totalTargets: targets.length
                }
            },
            timestamp: new Date().toISOString(),
            source: "aws-sdk"
        };

    } catch (error) {
        console.error("Error in getWatchdogData:", error);
        throw error;
    }
}
