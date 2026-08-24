export type FeedbackTargetType = "trace" | "span" | "request" | "dataset_run_item";
export type FeedbackSentiment = "positive" | "neutral" | "negative";

export interface FeedbackSummary {
  count: number;
  avgScore?: number | null;
  latestSentiment?: FeedbackSentiment | null;
  tags?: string[];
  lastFeedbackAt?: string | null;
}

export interface HumanFeedback {
  _id: string;
  targetType: FeedbackTargetType;
  targetId: string;
  traceId?: string | null;
  spanId?: string | null;
  requestId?: string | null;
  score?: number | null;
  sentiment?: FeedbackSentiment | null;
  comment?: string;
  tags?: string[];
  createdAt?: string;
}

export interface AnnotationMetadata {
  _id: string;
  targetType: "trace" | "span" | "request";
  targetId: string;
  traceId?: string | null;
  spanId?: string | null;
  requestId?: string | null;
  status: "open" | "reviewed" | "resolved" | "ignored";
  severity?: "low" | "medium" | "high" | "critical" | null;
  ownerId?: string | null;
  notes?: string;
  tags?: string[];
  labels?: Record<string, string>;
  feedbackIds?: string[];
  updatedAt?: string;
}
