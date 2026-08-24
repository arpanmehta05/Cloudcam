"use client";

import { Badge } from "@/components/ui/badge";
import type { AiTraceRow } from "../api";

interface TracePromptPreviewProps {
  trace: AiTraceRow;
}

export function TracePromptPreview({ trace }: TracePromptPreviewProps) {
  const preview = trace.promptPreview || trace.inputPreview;
  if (!preview) {
    return (
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        Prompt not captured
      </p>
    );
  }

  const source = [trace.previewSource?.provider, trace.previewSource?.modelName]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="mt-2 min-w-0 rounded border bg-secondary/10 px-2 py-1.5">
      <div className="mb-1 flex items-center gap-2">
        <Badge variant="outline" className="h-5 rounded text-[10px]">
          Prompt
        </Badge>
        {source ? <span className="truncate text-[10px] text-muted-foreground">{source}</span> : null}
      </div>
      <p className="line-clamp-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
        {preview}
      </p>
    </div>
  );
}
