import { AiTrace } from "../../../models/ai-trace.model";
import { buildScopeMatch, type AiScope } from "../services/scope.service";

export async function listEndUsers(scope: AiScope) {
  const rows = await AiTrace.aggregate([
    { $match: { ...buildScopeMatch(scope), endUserId: { $nin: [null, ""] } } },
    {
      $group: {
        _id: "$endUserId",
        traceCount: { $sum: 1 },
        sessionIds: { $addToSet: "$sessionId" },
        totalCost: { $sum: "$totalCost" },
        totalTokens: { $sum: "$totalTokens" },
        errorCount: { $sum: "$errorCount" },
        firstSeenAt: { $min: "$startedAt" },
        lastSeenAt: { $max: "$startedAt" },
      },
    },
    { $sort: { lastSeenAt: -1 } },
    { $limit: 100 },
  ]);

  return {
    users: rows.map(({ _id, ...row }) => ({
      endUserId: _id,
      ...row,
      sessionIds: row.sessionIds.filter(Boolean),
    })),
  };
}

export async function getEndUserDetail(scope: AiScope, endUserId: string) {
  const traces = await AiTrace.find({ ...buildScopeMatch(scope), endUserId })
    .sort({ startedAt: -1 })
    .limit(200)
    .lean();
  const sessionIds = [...new Set(traces.map((trace) => trace.sessionId).filter(Boolean))];
  return { endUserId, sessionIds, traces };
}
