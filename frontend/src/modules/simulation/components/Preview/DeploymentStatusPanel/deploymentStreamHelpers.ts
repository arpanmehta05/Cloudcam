import type { MutableRefObject } from "react";
import { isStage2StartLine } from "./deploymentStageStatus";

type TimeoutRef = MutableRefObject<NodeJS.Timeout | null>;
type EventSourceRef = MutableRefObject<EventSource | null>;

export function closeDeploymentStreams(
  eventSourceRef: EventSourceRef,
  pollingTimeoutRef: TimeoutRef,
) {
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }
  if (pollingTimeoutRef.current) {
    clearTimeout(pollingTimeoutRef.current);
    pollingTimeoutRef.current = null;
  }
}

export function readDeploymentEventLine(eventData: string) {
  try {
    const data = JSON.parse(eventData);
    return typeof data?.line === "string" ? data.line : eventData;
  } catch {
    return String(eventData);
  }
}

export function appendDeploymentStatusLogs({
  logs,
  appendLogLine,
  markStage2Start,
}: {
  logs?: Array<string | { line?: string }>;
  appendLogLine: (line: string) => void;
  markStage2Start: () => void;
}) {
  if (!logs?.length) return;
  for (const log of logs) {
    const line = typeof log === "string" ? log : log.line || String(log);
    if (isStage2StartLine(line)) {
      markStage2Start();
    }
    appendLogLine(line);
  }
}

export function isFailedDeploymentStatus(status: string) {
  return status === "failed" || status === "timed_out" || status === "cancelled";
}

export function shouldFinalizeAfterUploadPause(
  hasPausedForUpload: boolean,
  seenStage2Start: boolean,
) {
  return !hasPausedForUpload || seenStage2Start;
}

export function scheduleSuccessStatusChecks({
  depId,
  checkStatus,
  markComplete,
  terminalPhaseRef,
}: {
  depId: string;
  checkStatus: (depId: string) => void;
  markComplete: () => void;
  terminalPhaseRef: MutableRefObject<"complete" | "failed" | null>;
}) {
  setTimeout(() => checkStatus(depId), 1000);
  setTimeout(() => checkStatus(depId), 4000);
  setTimeout(() => {
    if (!terminalPhaseRef.current) markComplete();
  }, 8000);
}
