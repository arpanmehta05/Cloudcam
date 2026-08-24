import { AiRequestLog } from "../../../models/ai-request-log.model";
import { AiTrace } from "../../../models/ai-trace.model";
import { AiTraceSpan } from "../../../models/ai-trace-span.model";
import { HumanFeedback } from "../../../models/human-feedback.model";
import { AiScope, buildScopeMatch } from "../../../services/ai-scope.service";

export async function getTraceScores(scope: AiScope, traceId: string) {
  const scores = await HumanFeedback.find({ userId: scope.userId, traceId })
    .sort({ createdAt: -1 })
    .lean();
  return { scores };
}

export async function getTraceDetail(scope: AiScope, traceId: string) {
  const trace = await AiTrace.findOne({
    ...buildScopeMatch(scope),
    traceId,
  }).lean();
  if (!trace) return null;

  const [spans, requests, scores] = await Promise.all([
    AiTraceSpan.find({ userId: scope.userId, traceId }).sort({ startedAt: 1 }).lean(),
    AiRequestLog.find({ userId: scope.userId, traceId }).sort({ createdAt: 1 }).lean(),
    HumanFeedback.find({ userId: scope.userId, traceId }).sort({ createdAt: -1 }).lean(),
  ]);

  return { trace, spans, requests, scores };
}
