import { Request, Response } from "express";
import * as errorsService from "./errors.service";
import { resolveAiScope, hasExplicitEnvironment } from "../services/scope.service";
import { getCredentials } from "../../../store/workspace-credentials";
import { getBedrockConsoleMetrics } from "../../../services/aws/bedrock-metrics.service";

// GET /api/ai-observability/errors
export async function errorsGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    if (!hasExplicitEnvironment(req)) {
      scope.environment = undefined;
    }
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const range =
      typeof req.query.range === "string" ? req.query.range : undefined;
    const provider =
      typeof req.query.provider === "string" ? req.query.provider : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const includeCloudwatch =
      String(req.query.includeCloudwatch || "true") !== "false";
    const errors = await errorsService.getRecentErrors(scope, {
      limit,
      range,
      provider,
      status: status as "error" | "rate_limited" | "timeout" | undefined,
    });
    let cloudwatchErrors: Array<{
      timestamp: string;
      provider: "bedrock";
      status: "error";
      errorType: "client_error" | "server_error";
      errorCount: number;
      errorMessage: string;
      source: "cloudwatch";
    }> = [];

    const shouldIncludeBedrockCloudwatch =
      includeCloudwatch &&
      (!provider || provider === "all" || provider === "bedrock");
    if (shouldIncludeBedrockCloudwatch) {
      try {
        const creds = await getCredentials(userId);
        if (creds?.roleArn && creds?.externalId) {
          const window = range === "24h" ? "24h" : "12h";
          const region =
            typeof req.query.region === "string" ? req.query.region : undefined;
          const modelId =
            typeof req.query.modelId === "string"
              ? req.query.modelId
              : undefined;
          const metrics = await getBedrockConsoleMetrics(
            userId,
            creds.roleArn,
            creds.externalId,
            {
              window,
              region,
              modelId,
              limit: 100,
            },
          );

          cloudwatchErrors = metrics.series.reliability.flatMap((point) => {
            const rows: typeof cloudwatchErrors = [];
            if ((point.clientErrors || 0) > 0) {
              rows.push({
                timestamp: point.timestamp,
                provider: "bedrock",
                status: "error",
                errorType: "client_error",
                errorCount: Math.round(point.clientErrors),
                errorMessage:
                  "Bedrock client-side invocation errors reported by CloudWatch",
                source: "cloudwatch",
              });
            }
            if ((point.serverErrors || 0) > 0) {
              rows.push({
                timestamp: point.timestamp,
                provider: "bedrock",
                status: "error",
                errorType: "server_error",
                errorCount: Math.round(point.serverErrors),
                errorMessage:
                  "Bedrock server-side invocation errors reported by CloudWatch",
                source: "cloudwatch",
              });
            }
            return rows;
          });
        }
      } catch (cloudwatchErr) {
        console.error(
          "ai-observability errorsGet cloudwatch enrichment error:",
          cloudwatchErr,
        );
      }
    }

    return res.json({ success: true, errors, cloudwatchErrors });
  } catch (error) {
    console.error("ai-observability errorsGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch errors" });
  }
}
