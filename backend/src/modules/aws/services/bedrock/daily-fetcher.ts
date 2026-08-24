import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { getClientConfig } from "../../providers/client-factory";
import { BedrockDayMetric } from "./metric-helpers";

export async function fetchBedrockCloudWatchMetrics(
  userId: string,
  roleArn: string,
  externalId: string,
  region: string = "us-east-1",
  daysBack: number = 1
): Promise<BedrockDayMetric[]> {
  const clientConfig = await getClientConfig(userId, region, roleArn, externalId);
  const cw = new CloudWatchClient(clientConfig);

  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - daysBack);
  startTime.setHours(0, 0, 0, 0);

  try {
    const response = await cw.send(
      new GetMetricDataCommand({
        StartTime: startTime,
        EndTime: endTime,
        MetricDataQueries: [
          {
            Id: "invocations",
            MetricStat: {
              Metric: {
                Namespace: "AWS/Bedrock",
                MetricName: "Invocations",
                Dimensions: [],
              },
              Period: 86400,
              Stat: "Sum",
            },
          },
          {
            Id: "inputTokens",
            MetricStat: {
              Metric: {
                Namespace: "AWS/Bedrock",
                MetricName: "InputTokenCount",
                Dimensions: [],
              },
              Period: 86400,
              Stat: "Sum",
            },
          },
          {
            Id: "outputTokens",
            MetricStat: {
              Metric: {
                Namespace: "AWS/Bedrock",
                MetricName: "OutputTokenCount",
                Dimensions: [],
              },
              Period: 86400,
              Stat: "Sum",
            },
          },
          {
            Id: "latency",
            MetricStat: {
              Metric: {
                Namespace: "AWS/Bedrock",
                MetricName: "InvocationLatency",
                Dimensions: [],
              },
              Period: 86400,
              Stat: "Average",
            },
          },
          {
            Id: "errors",
            MetricStat: {
              Metric: {
                Namespace: "AWS/Bedrock",
                MetricName: "InvocationClientErrors",
                Dimensions: [],
              },
              Period: 86400,
              Stat: "Sum",
            },
          },
        ],
      })
    );

    const results: Record<string, BedrockDayMetric> = {};
    for (const metricResult of response.MetricDataResults || []) {
      const id = metricResult.Id!;
      const timestamps = metricResult.Timestamps || [];
      const values = metricResult.Values || [];

      for (let i = 0; i < timestamps.length; i++) {
        const date = timestamps[i].toISOString().slice(0, 10);
        if (!results[date]) {
          results[date] = { date, invocations: 0, inputTokens: 0, outputTokens: 0, latencyMs: 0, errors: 0 };
        }
        const val = values[i] || 0;
        switch (id) {
          case "invocations": results[date].invocations = Math.round(val); break;
          case "inputTokens": results[date].inputTokens = Math.round(val); break;
          case "outputTokens": results[date].outputTokens = Math.round(val); break;
          case "latency": results[date].latencyMs = Math.round(val); break;
          case "errors": results[date].errors = Math.round(val); break;
        }
      }
    }

    return Object.values(results).sort((a, b) => a.date.localeCompare(b.date));
  } catch (err: any) {
    console.error(`[Bedrock-Metrics] CloudWatch fetch failed for ${userId}:`, err.message);
    return [];
  }
}
