export interface EvaluationMetric {
  name: string;
  score: number;
  passed: boolean;
  reasoning?: string;
}

export interface AiEvaluation {
  _id: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  status: "pass" | "fail";
  score: number;
  metrics: EvaluationMetric[];
  reasoning?: string;
  judgeModel: string;
  createdAt: string;
}

export interface EvaluationStats {
  totalCount: number;
  avgScore: number;
  passRate: number;
  metricsBreakdown: {
    grounding: number | null;
    safety: number | null;
    relevance: number | null;
    coherence: number | null;
  };
}

export interface PendingLog {
  requestId: string;
  endpoint?: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  createdAt: string;
}

export interface EvaluationErrorModalState {
  isOpen: boolean;
  title: string;
  message: string;
  requestId?: string;
  isKeyError?: boolean;
  isRateLimit?: boolean;
}

export interface EvaluationsResponse {
  success: boolean;
  evaluations?: AiEvaluation[];
  stats?: EvaluationStats;
  pendingLogs?: PendingLog[];
  error?: string;
}

export interface RunEvaluationResponse {
  success: boolean;
  evaluation?: AiEvaluation;
  error?: string;
}
