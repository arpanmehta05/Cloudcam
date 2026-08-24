"use client";

import { useEffect, useState } from "react";
import { getEndUser, type AiTraceRow } from "../api";

export function useUserDetail(endUserId: string) {
  const [traces, setTraces] = useState<AiTraceRow[]>([]);

  useEffect(() => {
    if (!endUserId) return;
    getEndUser(endUserId).then((data) => setTraces(data.traces)).catch(() => setTraces([]));
  }, [endUserId]);

  return { traces };
}
