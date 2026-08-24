import { AiRequestLog } from "../../../models/ai-request-log.model";
import { AiTrace } from "../../../models/ai-trace.model";
import { AiTraceSpan } from "../../../models/ai-trace-span.model";
import { HumanFeedback, type FeedbackTargetType } from "../../../models/human-feedback.model";

interface SummaryTarget {
  userId: string;
  targetType: FeedbackTargetType;
  targetId: string;
  traceId?: string | null;
  spanId?: string | null;
  requestId?: string | null;
}

async function buildSummary(target: SummaryTarget) {
  const feedback = await HumanFeedback.find({
    userId: target.userId,
    targetType: target.targetType,
    targetId: target.targetId,
  })
    .sort({ createdAt: -1 })
    .lean();

  const scores = feedback
    .map((entry) => entry.score)
    .filter((score): score is number => typeof score === "number");
  const tags = Array.from(new Set(feedback.flatMap((entry) => entry.tags || [])));
  return {
    count: feedback.length,
    avgScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    latestSentiment: feedback[0]?.sentiment || null,
    tags,
    lastFeedbackAt: feedback[0]?.createdAt || null,
  };
}

export async function refreshFeedbackSummary(target: SummaryTarget) {
  const summary = await buildSummary(target);
  if (target.targetType === "trace" && target.traceId) {
    await AiTrace.updateOne(
      { userId: target.userId, traceId: target.traceId },
      { $set: { feedbackSummary: summary } },
    );
  }
  if (target.targetType === "span" && target.traceId && target.spanId) {
    await AiTraceSpan.updateOne(
      { userId: target.userId, traceId: target.traceId, spanId: target.spanId },
      { $set: { feedbackSummary: summary } },
    );
  }
  if (target.targetType === "request" && target.requestId) {
    await AiRequestLog.updateOne(
      { userId: target.userId, requestId: target.requestId },
      { $set: { feedbackSummary: summary } },
    );
  }
  return summary;
}
