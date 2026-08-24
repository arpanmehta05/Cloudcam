import { AiTrace } from "../../../models/ai-trace.model";
import { AiTraceSpan } from "../../../models/ai-trace-span.model";
import { buildScopeMatch, type AiScope } from "../services/scope.service";

export async function listSessions(scope: AiScope) {
  const rows = await AiTrace.aggregate([
    { $match: { ...buildScopeMatch(scope), sessionId: { $nin: [null, ""] } } },
    {
      $group: {
        _id: "$sessionId",
        traceCount: { $sum: 1 },
        totalCost: { $sum: "$totalCost" },
        totalTokens: { $sum: "$totalTokens" },
        errorCount: { $sum: "$errorCount" },
        durationMs: { $sum: "$durationMs" },
        startedAt: { $min: "$startedAt" },
        lastSeenAt: { $max: "$startedAt" },
        endUserIds: { $addToSet: "$endUserId" },
      },
    },
    { $sort: { lastSeenAt: -1 } },
    { $limit: 100 },
  ]);

  return {
    sessions: rows.map(({ _id, ...row }) => ({
      sessionId: _id,
      ...row,
      endUserIds: row.endUserIds.filter(Boolean),
    })),
  };
}

export async function getSessionDetail(scope: AiScope, sessionId: string) {
  const traces = await AiTrace.find({ ...buildScopeMatch(scope), sessionId })
    .sort({ startedAt: 1 })
    .lean();
  const traceIds = traces.map((trace) => trace.traceId);
  const spans = await AiTraceSpan.find({ userId: scope.userId, traceId: { $in: traceIds } })
    .sort({ startedAt: 1 })
    .lean();
  return { sessionId, traces, spans };
}
