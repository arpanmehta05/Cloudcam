import { useCallback, useEffect, useRef, useState } from "react";
import { feedbackApi } from "../api/feedback.api";
import type { AnnotationMetadata, FeedbackSentiment, HumanFeedback } from "../types/feedback";

export function useTraceFeedback(traceId?: string) {
  const [feedback, setFeedback] = useState<HumanFeedback[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!traceId) return;
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const [nextFeedback, nextAnnotations] = await Promise.all([
        feedbackApi.list({ targetType: "trace", traceId }),
        feedbackApi.listAnnotations({ traceId }),
      ]);
      if (requestVersion !== requestVersionRef.current) return;
      setFeedback(nextFeedback.feedback || []);
      setAnnotations(nextAnnotations.annotations || []);
    } catch (err: any) {
      if (requestVersion !== requestVersionRef.current) return;
      setError(err.message || "Failed to load feedback");
    } finally {
      if (requestVersion === requestVersionRef.current) setLoading(false);
    }
  }, [traceId]);

  const submitTraceFeedback = useCallback(async (input: {
    score?: number;
    sentiment?: FeedbackSentiment;
    comment?: string;
    tags?: string[];
  }) => {
    if (!traceId) throw new Error("traceId is required");
    const result = await feedbackApi.submit({ targetType: "trace", traceId, ...input });
    await refresh();
    return result;
  }, [refresh, traceId]);

  const upsertTraceAnnotation = useCallback(async (input: Partial<AnnotationMetadata>) => {
    if (!traceId) throw new Error("traceId is required");
    const result = await feedbackApi.upsertAnnotation({ targetType: "trace", traceId, ...input });
    await refresh();
    return result;
  }, [refresh, traceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { feedback, annotations, loading, error, refresh, submitTraceFeedback, upsertTraceAnnotation };
}
