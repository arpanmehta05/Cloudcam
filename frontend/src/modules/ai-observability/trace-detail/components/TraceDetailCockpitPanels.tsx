"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiTraceDetail, AiTraceSpan, TraceScoreRow } from "../api";
import { money } from "../../shared/ObservabilityPageShell";

function value(text?: string | number | null) {
  if (text === undefined || text === null || text === "") return "n/a";
  return String(text);
}

function scoreValue(score: TraceScoreRow) {
  if (typeof score.score === "number") return Number.isInteger(score.score) ? `${score.score}` : score.score.toFixed(2);
  if (typeof score.boolValue === "boolean") return score.boolValue ? "true" : "false";
  return value(score.stringValue || score.sentiment);
}

/** A readable label for a score. The backend persists no metric name, so we
 *  derive one from a `metric=value` style comment, falling back to source. */
function scoreLabel(score: TraceScoreRow) {
  const raw = (score.comment || "").trim();
  if (raw) {
    const head = raw.split(/[=:]/)[0].trim();
    if (head && head.length <= 32) return head;
    return raw;
  }
  return score.source || score.targetType || "score";
}

/** Colour a numeric/boolean score badge: green = good, amber = mid, red = poor.
 *  Metrics where lower is better (hallucination) invert. */
function scoreTone(score: TraceScoreRow): "default" | "secondary" | "destructive" | "outline" {
  const label = scoreLabel(score).toLowerCase();
  const lowerIsBetter = label.includes("halluc") || label.includes("error") || label.includes("toxic");
  if (typeof score.boolValue === "boolean") {
    const good = lowerIsBetter ? !score.boolValue : score.boolValue;
    return good ? "default" : "destructive";
  }
  if (typeof score.score === "number") {
    const v = lowerIsBetter ? 1 - score.score : score.score;
    if (v >= 0.7) return "default";
    if (v >= 0.4) return "secondary";
    return "destructive";
  }
  return "outline";
}

function matchingScores(scores: TraceScoreRow[], selected: AiTraceSpan | null) {
  const traceScores = scores.filter((score) => score.targetType === "trace");
  let list = traceScores;
  if (selected) {
    const spanScores = scores.filter((score) => score.spanId === selected.spanId || score.targetId === selected.spanId);
    list = spanScores.length ? spanScores : traceScores;
  }
  // Show every metric. Previously this was `.slice(0, 5)` on a newest-first list,
  // which silently dropped the 3 oldest scores (context_precision/recall/
  // faithfulness). Sort by label for stable, readable ordering.
  return [...list].sort((a, b) => scoreLabel(a).localeCompare(scoreLabel(b)));
}

function KeyValues({ rows }: { rows: Array<[string, string | number | null | undefined]> }) {
  return (
    <div className="divide-y divide-border/50 text-sm">
      {rows.map(([label, rowValue]) => (
        <div key={label} className="flex items-center justify-between gap-4 py-2">
          <span className="shrink-0 text-muted-foreground">{label}</span>
          <span className="min-w-0 truncate text-right font-medium" title={value(rowValue)}>{value(rowValue)}</span>
        </div>
      ))}
    </div>
  );
}

/** Marks a panel as showing the currently-selected span (not the trace total). */
function SelectedSpanTag({ selected }: { selected: AiTraceSpan | null }) {
  if (!selected) return null;
  return (
    <span className="ml-2 shrink-0 truncate rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground" title={selected.name}>
      {selected.name}
    </span>
  );
}

export function TraceDetailCockpitPanels({ detail, selected }: { detail: AiTraceDetail; selected: AiTraceSpan | null }) {
  const scores = matchingScores(detail.scores || [], selected);
  const cost = selected?.cost ?? detail.trace.totalCost ?? 0;
  const promptName = selected?.promptName || detail.trace.promptName || selected?.promptSlug || detail.trace.promptSlug;
  const promptVersion = selected?.promptVersion || detail.trace.promptVersion || detail.trace.promptLabel;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-lg">
        <CardHeader className="pb-2"><CardTitle className="flex items-center text-base">Observation<SelectedSpanTag selected={selected} /></CardTitle></CardHeader>
        <CardContent>
          <KeyValues rows={[
            ["Kind", selected?.kind || "trace"],
            ["Status", selected?.status || detail.trace.status],
            ["Latency", `${selected?.durationMs ?? detail.trace.durationMs ?? 0}ms`],
            ["Endpoint", selected?.endpoint || detail.trace.endpoint],
            ["Session", selected?.sessionId || detail.trace.sessionId],
            ["User", selected?.endUserId || detail.trace.endUserId],
          ]} />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="pb-2"><CardTitle className="flex items-center text-base">Cost<SelectedSpanTag selected={selected} /></CardTitle></CardHeader>
        <CardContent>
          <KeyValues rows={[
            ["Cost", money(cost)],
            ["Pricing", selected?.pricingSource || detail.trace.pricingSources?.join(", ")],
            ["Prompt tokens", selected?.promptTokens ?? detail.requests[0]?.promptTokens],
            ["Completion", selected?.completionTokens ?? detail.requests[0]?.completionTokens],
            ["Total tokens", selected?.totalTokens ?? detail.requests[0]?.totalTokens ?? detail.trace.totalTokens],
            ["Unpriced spans", detail.trace.unpricedSpanCount || 0],
          ]} />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="pb-2"><CardTitle className="flex items-center text-base">Prompt<SelectedSpanTag selected={selected} /></CardTitle></CardHeader>
        <CardContent>
          <KeyValues rows={[
            ["Name", promptName],
            ["Version", promptVersion],
            ["Label", selected?.promptLabel || detail.trace.promptLabel],
            ["Environment", selected?.promptEnvironment || detail.trace.promptEnvironment],
            ["State", selected?.promptState || detail.trace.promptState],
            ["Hash", selected?.promptHash || detail.trace.promptHash],
          ]} />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            Scores
            {scores.length > 0 && <span className="text-xs font-normal text-muted-foreground">{scores.length} metric{scores.length === 1 ? "" : "s"}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scores.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {scores.map((score) => (
                <div key={score._id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate capitalize" title={score.comment || undefined}>{scoreLabel(score)}</span>
                  <Badge variant={scoreTone(score)} className="shrink-0 font-mono">{scoreValue(score)}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No scores yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
