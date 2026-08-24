"use client";

import { useEffect, useState } from "react";
import { listSessions, type AiSessionRow } from "../api";

export function useSessions() {
  const [sessions, setSessions] = useState<AiSessionRow[]>([]);

  useEffect(() => {
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  return { sessions };
}
