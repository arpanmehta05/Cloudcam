"use client";

import { useEffect, useState } from "react";
import { getSession, type AiTraceRow } from "../api";

export function useSessionDetail(sessionId: string) {
  const [traces, setTraces] = useState<AiTraceRow[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((data) => setTraces(data.traces)).catch(() => setTraces([]));
  }, [sessionId]);

  return { traces };
}
