import { authFetch } from "@/lib/auth-fetch";

import type { EvaluationsResponse, RunEvaluationResponse } from "./types";

export async function fetchEvaluationsDashboard(): Promise<EvaluationsResponse> {
  const res = await authFetch("/api/evaluations");
  return res.json();
}

export async function runEvaluationAudit(params: {
  requestId: string;
  judgeProvider: string;
  judgeModel: string;
  judgeApiKey?: string;
}): Promise<RunEvaluationResponse> {
  const res = await authFetch("/api/evaluations/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}
