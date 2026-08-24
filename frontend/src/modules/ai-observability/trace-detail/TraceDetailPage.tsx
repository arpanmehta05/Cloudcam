"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Loader2 } from "@/icons";
import { money, ObservabilityPageShell } from "../shared/ObservabilityPageShell";
import { TraceDetailCockpitPanels } from "./components/TraceDetailCockpitPanels";
import { TraceDetailSummaryBar } from "./components/TraceDetailSummaryBar";
import { TraceWaterfallPanel } from "./components/TraceWaterfallPanel";
import { useTraceDetail } from "./hooks/useTraceDetail";

function statusVariant(status: string): "destructive" | "secondary" | "outline" | "default" {
  if (status === "error" || status === "timeout") return "destructive";
  if (status === "partial" || status === "rate_limited") return "secondary";
  if (status === "success") return "default";
  return "outline";
}

function preview(text?: string) {
  if (!text) return "No preview captured.";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function firstText(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function pricingLabel(source?: string | null, estimated?: boolean | null) {
  if (source === "unpriced") return "Unpriced";
  if (!source) return "Unknown";
  return `${source}${estimated === false ? " / not estimated" : ""}`;
}

export default function TraceDetailPage() {
  const traceId = String(useParams()?.traceId || "");
  const { detail, selected, setSelected, loading } = useTraceDetail(traceId);
  const [copyStatus, setCopyStatus] = useState("");

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!detail) return <Card><CardContent className="p-8">Trace not found.</CardContent></Card>;

  const firstRequest = detail.requests[0];
  const pricingSource = selected?.pricingSource || firstRequest?.pricingSource || detail.trace.pricingSources?.[0];
  const pricingEstimated = selected?.pricingEstimated ?? firstRequest?.pricingEstimated;
  const isUnpriced = Boolean(selected?.unpriced || firstRequest?.unpriced || detail.trace.unpricedSpanCount);
  const prompt = {
    name: firstText(selected?.promptName, detail.trace.promptName, firstRequest?.promptName, selected?.promptSlug, detail.trace.promptSlug),
    version: firstText(selected?.promptVersion, detail.trace.promptVersion, firstRequest?.promptVersion),
    label: firstText(selected?.promptLabel, detail.trace.promptLabel, firstRequest?.promptLabel),
    hash: firstText(selected?.promptHash, detail.trace.promptHash, firstRequest?.promptHash),
  };
  const selectedJson = selected
    ? JSON.stringify({ span: selected, metadata: selected.metadata || {} }, null, 2)
    : JSON.stringify({ trace: detail.trace }, null, 2);
  const copyJson = async () => {
    await navigator.clipboard.writeText(selectedJson);
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus(""), 1200);
  };

  return (
    <ObservabilityPageShell
      title={detail.trace.name || "Trace Detail"}
      subtitle={detail.trace.traceId}
      actions={<Link href="/ai-observability/traces"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Traces</Button></Link>}
    >
      <TraceDetailSummaryBar detail={detail} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <TraceWaterfallPanel spans={detail.spans} selectedId={selected?.spanId} onSelect={setSelected} />

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">Selected span</span>
                <span className="truncate">{selected?.name || "—"}</span>
              </span>
              <Badge variant={statusVariant(selected?.status || detail.trace.status)}>{selected?.status || detail.trace.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-muted-foreground">Kind</span><span>{selected?.kind || "trace"}</span>
              <span className="text-muted-foreground">Model</span><span>{selected?.modelName || "unknown"}</span>
              <span className="text-muted-foreground">Cost</span><span>{money(selected?.cost || detail.trace.totalCost || 0)}</span>
              <span className="text-muted-foreground">Pricing</span>
              <span className="flex items-center gap-2">{pricingLabel(pricingSource, pricingEstimated)}{isUnpriced && <Badge variant="secondary">unpriced</Badge>}</span>
              <span className="text-muted-foreground">TTFT</span><span>{selected?.completionStartTime ? new Date(selected.completionStartTime).toLocaleTimeString() : "n/a"}</span>
              <span className="text-muted-foreground">Prompt</span><span className="truncate">{prompt.name || "n/a"}</span>
              <span className="text-muted-foreground">Prompt version</span><span>{prompt.version || "n/a"}</span>
              <span className="text-muted-foreground">Prompt label</span><span>{prompt.label || "n/a"}</span>
              <span className="text-muted-foreground">Prompt hash</span><span className="truncate font-mono">{prompt.hash || "n/a"}</span>
            </div>
            <pre className="max-h-72 overflow-auto rounded-md border bg-secondary/20 p-3 text-xs">{preview(selected?.inputPreview || selected?.outputPreview)}</pre>
            <div className="rounded-md border bg-secondary/10">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-xs font-semibold">Selected JSON</span>
                <Button variant="ghost" size="sm" onClick={copyJson} aria-label="Copy selected JSON">
                  <Copy className="mr-2 h-3.5 w-3.5" />{copyStatus || "Copy"}
                </Button>
              </div>
              <pre className="max-h-48 overflow-auto p-3 text-xs">{selectedJson}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <TraceDetailCockpitPanels detail={detail} selected={selected} />
    </ObservabilityPageShell>
  );
}
