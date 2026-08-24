import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import { getClientConfig, COST_EXPLORER_REGION } from "../../providers/client-factory";

export interface BedrockCostRow {
  date: string;
  cost: number;
  service: string;
}

function daysAgoString(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch Bedrock-specific costs from AWS Cost Explorer.
 * Returns daily cost rows.
 */
export async function fetchBedrockCosts(
  userId: string,
  roleArn: string,
  externalId: string,
  daysBack: number = 7
): Promise<BedrockCostRow[]> {
  const clientConfig = await getClientConfig(userId, COST_EXPLORER_REGION, roleArn, externalId);
  const ce = new CostExplorerClient(clientConfig);

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = daysAgoString(daysBack);

  try {
    const response = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: "DAILY",
        Metrics: ["BlendedCost"],
        Filter: {
          Dimensions: {
            Key: "SERVICE",
            Values: ["Amazon Bedrock"],
          },
        },
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      })
    );

    const rows: BedrockCostRow[] = [];
    for (const result of response.ResultsByTime || []) {
      const date = result.TimePeriod?.Start || "";
      for (const group of result.Groups || []) {
        const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || "0");
        const service = group.Keys?.[0] || "Amazon Bedrock";
        if (cost > 0) {
          rows.push({ date, cost, service });
        }
      }
    }
    return rows;
  } catch (err: any) {
    console.error(`[Bedrock-Metrics] Cost Explorer fetch failed for ${userId}:`, err.message);
    return [];
  }
}
