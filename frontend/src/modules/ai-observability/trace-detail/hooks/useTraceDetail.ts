"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTrace,
  type AiTraceDetail,
  type AiTraceSpan,
} from "../api";

function useTraceSpanKeyboard(
  detail: AiTraceDetail | null,
  selected: AiTraceSpan | null,
  setSelected: (span: AiTraceSpan) => void,
) {
  const selectedIndex = useMemo(
    () =>
      detail?.spans.findIndex((span) => span.spanId === selected?.spanId) ??
      -1,
    [detail?.spans, selected?.spanId],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!detail?.spans.length) return;
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (typing) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected(
          detail.spans[
            Math.min(
              (selectedIndex < 0 ? 0 : selectedIndex) + 1,
              detail.spans.length - 1,
            )
          ],
        );
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected(
          detail.spans[Math.max((selectedIndex < 0 ? 0 : selectedIndex) - 1, 0)],
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail?.spans, selectedIndex, setSelected]);
}

export function traceDetailKey(traceId: string) {
  return ["ai-trace", traceId] as const;
}

export function useTraceDetail(traceId: string) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: traceDetailKey(traceId),
    queryFn: () => getTrace(traceId),
    enabled: Boolean(traceId),
  });
  const detail = data ?? null;

  const selected = useMemo<AiTraceSpan | null>(() => {
    if (!detail) return null;
    return (
      detail.spans.find((span) => span.spanId === selectedSpanId) ||
      detail.spans[0] ||
      null
    );
  }, [detail, selectedSpanId]);

  const setSelected = useCallback(
    (span: AiTraceSpan) => setSelectedSpanId(span.spanId),
    [],
  );

  useTraceSpanKeyboard(detail, selected, setSelected);

  return {
    detail,
    selected,
    setSelected,
    loading: isLoading,
  };
}
