import { AiEvaluation } from "../../../models/ai-evaluation.model";
import { AiRequestLog } from "../../../models/ai-request-log.model";
import * as evaluationService from "../services/ai-evaluation.service";

export async function getEvaluationDashboard(params: {
  userId: string;
  page: number;
  limit: number;
}) {
  const skip = (params.page - 1) * params.limit;

  const evaluations = await AiEvaluation.find({ userId: params.userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(params.limit);

  const total = await AiEvaluation.countDocuments({ userId: params.userId });

  const allEvaluations = await AiEvaluation.find({ userId: params.userId })
    .select("score status metrics")
    .lean();
  const totalCount = allEvaluations.length;

  let avgScore = 0;
  let passRate = 0;
  const metricTotals: Record<string, { sum: number; count: number }> = {
    grounding: { sum: 0, count: 0 },
    safety: { sum: 0, count: 0 },
    relevance: { sum: 0, count: 0 },
    coherence: { sum: 0, count: 0 },
  };

  if (totalCount > 0) {
    const sumScore = allEvaluations.reduce(
      (sum, evaluation) => sum + (evaluation.score || 0),
      0,
    );
    avgScore = Math.round(sumScore / totalCount);

    const passedCount = allEvaluations.filter(
      (evaluation) => evaluation.status === "pass",
    ).length;
    passRate = Math.round((passedCount / totalCount) * 100);

    allEvaluations.forEach((evaluation) => {
      if (Array.isArray(evaluation.metrics)) {
        evaluation.metrics.forEach((metric) => {
          const name = metric.name?.toLowerCase();
          if (metricTotals[name]) {
            metricTotals[name].sum += metric.score || 0;
            metricTotals[name].count += 1;
          }
        });
      }
    });
  }

  const metricsBreakdown = {
    grounding: averageMetric(metricTotals.grounding),
    safety: averageMetric(metricTotals.safety),
    relevance: averageMetric(metricTotals.relevance),
    coherence: averageMetric(metricTotals.coherence),
  };

  const evaluatedRequestIds = allEvaluations
    .map((evaluation) => evaluation.requestId)
    .filter((id): id is string => typeof id === "string");
  const pendingLogs = await AiRequestLog.find({
    userId: params.userId,
    requestId: { $nin: evaluatedRequestIds },
    status: "success",
    inputPreview: { $ne: null },
    outputPreview: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("requestId endpoint modelName promptTokens completionTokens createdAt");

  return {
    evaluations,
    stats: {
      totalCount,
      avgScore,
      passRate,
      metricsBreakdown,
    },
    pendingLogs,
    pagination: {
      total,
      page: params.page,
      limit: params.limit,
      pages: Math.ceil(total / params.limit),
    },
  };
}

export async function runDashboardEvaluation(params: {
  userId: string;
  requestId: string;
  judgeProvider?: string;
  judgeModel?: string;
  judgeApiKey?: string;
}) {
  return evaluationService.runEvaluationForRequest(
    params.userId,
    params.requestId,
    params.judgeProvider,
    params.judgeModel,
    params.judgeApiKey,
  );
}

function averageMetric(metric: { sum: number; count: number }) {
  return metric.count > 0 ? Math.round(metric.sum / metric.count) : null;
}
