import { AiRequestLog } from "../../../models/ai-request-log.model";
import { AiScope, buildScopeMatch } from "../services/scope.service";
import { parseDateRange } from "../services/overview.service";

export interface RecentErrorsOptions {
  limit?: number;
  range?: string;
  provider?: string;
  status?: "error" | "rate_limited" | "timeout";
}

export async function getRecentErrors(scope: AiScope, options: RecentErrorsOptions = {}) {
  const cap = Math.min(Math.max(options.limit || 50, 1), 200);
  const query: Record<string, any> = {
    ...buildScopeMatch(scope),
    status: { $ne: "success" },
  };

  if (options.range) {
    query.createdAt = { $gte: parseDateRange(options.range) };
  }
  if (options.provider && options.provider !== "all") {
    query.provider = options.provider;
  }
  if (options.status) {
    query.status = options.status;
  }

  return AiRequestLog.find(query, { __v: 0 })
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();
}
