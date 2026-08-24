"use client";

import { useQuery } from "@tanstack/react-query";
import { getReport, listAgents } from "./api";
import type { Agent, ReportDetail } from "./types";

const LIVE_REFETCH_MS = 10_000;

export function useAgents(enabled: boolean) {
  const query = useQuery({
    queryKey: ["cloudwatcher-agents"],
    queryFn: listAgents,
    enabled,
    refetchInterval: LIVE_REFETCH_MS,
    placeholderData: (previous) => previous,
  });

  return {
    data: (query.data ?? null) as Agent[] | null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}

export function useReport(reportId: string | null) {
  const query = useQuery({
    queryKey: ["cloudwatcher-report", reportId],
    queryFn: () => getReport(reportId as string),
    enabled: !!reportId,
    refetchInterval: (query) => {
      const report = query.state.data as ReportDetail | undefined;
      return report?.status === "scored" || report?.status === "invalid" ? false : LIVE_REFETCH_MS;
    },
    placeholderData: (previous) => previous,
  });

  return {
    data: reportId ? ((query.data ?? null) as ReportDetail | null) : null,
    loading: reportId ? query.isLoading : false,
    error: reportId ? (query.error instanceof Error ? query.error.message : null) : null,
  };
}
