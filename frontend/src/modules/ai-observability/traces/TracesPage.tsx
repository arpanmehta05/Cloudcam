"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Database, Info, Search, X } from "@/icons";
import { listTraces, type AiTraceRow } from "./api";
import { money, ObservabilityPageShell } from "../shared/ObservabilityPageShell";
import { TracePromptPreview } from "./components/TracePromptPreview";
import { parseTraceQuery, QUERY_EXAMPLES, removeToken } from "./utils/traceQuery";

function duration(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${value || 0}ms`;
}

function statusVariant(status: string): "destructive" | "secondary" | "outline" | "default" {
  if (status === "error") return "destructive";
  if (status === "partial") return "secondary";
  if (status === "success") return "default";
  return "outline";
}

const SDK_SNIPPET = `import { RabbittWatchAI } from "@rabbittwatch/ai-observability";
const rw = new RabbittWatchAI({ apiKey: process.env.RABBITTWATCH_API_KEY });
const trace = rw.startTrace({ name: "chat", provider: "openai", model: "gpt-4o" });
// … your LLM call …
await trace.flush();`;

function TracesEmptyState() {
  return (
    <Card className="rounded-lg border-dashed">
      <CardContent className="p-10 text-center">
        <Database className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" />
        <h3 className="text-sm font-semibold">No traces yet</h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Traces appear here once your app sends telemetry. Instrument a call with the SDK, or run
          <span className="mx-1 font-mono">ai-observability send-test-trace</span>
          from the CLI to verify ingestion.
        </p>
        <pre className="mx-auto mt-4 max-w-lg overflow-x-auto rounded border bg-secondary/10 p-3 text-left text-[11px] font-mono leading-relaxed">
          {SDK_SNIPPET}
        </pre>
      </CardContent>
    </Card>
  );
}

export default function TracesPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseTraceQuery(debouncedQuery), [debouncedQuery]);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("q");
    if (initialQuery) setQuery(initialQuery);
  }, []);

  // Debounce so we don't fire a request on every keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Live traces list: refetches on the given filters and polls every 10s so new
  // traces (and updated cost/latency) appear without a manual refresh.
  const { data, isLoading } = useQuery({
    queryKey: ["ai-traces", parsed.params],
    queryFn: () => listTraces({ ...parsed.params, limit: 100 }),
    refetchInterval: 10_000,
    placeholderData: (previous) => previous,
  });
  const traces = useMemo<AiTraceRow[]>(() => data?.traces || [], [data]);
  const loading = isLoading;

  // Reset the keyboard cursor to the top when the filter changes (not on every
  // background poll, so live refreshes don't jump the user's selection).
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  const applyExample = useCallback((q: string) => {
    setQuery((prev) => (prev.trim() ? `${prev.trim()} ${q}` : q));
    searchRef.current?.focus();
  }, []);

  const openTrace = useCallback((traceId: string) => {
    router.push(`/ai-observability/traces/${encodeURIComponent(traceId)}`);
  }, [router]);

  // Keyboard shortcuts: "/" focus search, arrows to move selection, Enter to open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing && event.key !== "Enter") return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, traces.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter" && traces[selectedIndex]) {
        openTrace(traces[selectedIndex].traceId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [traces, selectedIndex, openTrace]);

  return (
    <ObservabilityPageShell title="Trace Explorer" subtitle="Type words to search by name, or use filters like status:error, user:u_42, cost>0.01. Tap a chip below or “How to search”.">
      <Card className="rounded-lg border-white/10 bg-background/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9 pr-24 font-mono"
              placeholder="Type words to search, or filters like  status:error  cost>0.01"
              aria-label="Trace query"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] hover:bg-secondary ${showHelp ? "text-foreground" : "text-muted-foreground"}`}
                aria-expanded={showHelp}
              >
                <Info className="h-3.5 w-3.5" /> How to search
                <ChevronDown className={`h-3 w-3 transition-transform ${showHelp ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* Quick filters — click to add. The fastest path for first-time users. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUERY_EXAMPLES.map((ex) => (
              <button
                key={ex.q}
                type="button"
                onClick={() => applyExample(ex.q)}
                title={ex.hint}
                className="rounded-full border border-dashed px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition hover:border-solid hover:bg-primary/10 hover:text-foreground"
              >
                {ex.q}
              </button>
            ))}
          </div>

          {/* Active filters — each removable. */}
          {parsed.chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {parsed.chips.map((chip) => (
                <Badge key={chip.token} variant="outline" className="gap-1 pr-1">
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => setQuery((q) => removeToken(q, chip.token))}
                    className="rounded-full p-0.5 hover:bg-secondary"
                    aria-label={`Remove ${chip.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {parsed.ignored.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-500">
              Ignored (not a valid filter): <span className="font-mono">{parsed.ignored.join(" ")}</span>.
              Try a field like <span className="font-mono">status:</span> or just type words to search by name.
            </p>
          )}

          {showHelp && (
            <div className="mt-3 rounded-md border bg-secondary/20 p-3 text-xs leading-relaxed">
              <p className="mb-2 font-semibold">Three ways to search</p>
              <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                <li><b className="text-foreground">Type words</b> to match the trace name — e.g. <span className="font-mono">chat</span>.</li>
                <li><b className="text-foreground">Filter by field</b> with <span className="font-mono">field:value</span> — e.g. <span className="font-mono">status:error</span>, <span className="font-mono">user:user_42</span>, <span className="font-mono">session:s_123</span>, <span className="font-mono">env:staging</span>.</li>
                <li><b className="text-foreground">Compare numbers</b> with <span className="font-mono">&gt;</span> / <span className="font-mono">&lt;</span> — e.g. <span className="font-mono">cost&gt;0.01</span>, <span className="font-mono">latency&lt;500ms</span> (or <span className="font-mono">latency&gt;2s</span>).</li>
              </ol>
              <p className="mt-2 text-muted-foreground">Combine them with spaces — filters use AND. Aliases: <span className="font-mono">user</span>=endUserId, <span className="font-mono">session</span>=sessionId, <span className="font-mono">env</span>=environment.</p>
            </div>
          )}

          <p className="mt-2 text-[10px] text-muted-foreground">
            <span className="font-mono">/</span> focus search · <span className="font-mono">↑ ↓</span> select · <span className="font-mono">enter</span> open
          </p>
        </CardContent>
      </Card>

      {!loading && traces.length === 0 ? (
        <TracesEmptyState />
      ) : (
        <Card className="rounded-lg">
          <CardContent className="p-0">
            <div className="grid border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground items-center md:grid-cols-[1fr_110px_110px_110px_130px]">
              <span>Trace</span><span>Status</span><span>Latency</span><span>Cost</span><span>Started</span>
            </div>
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid gap-3 border-b px-4 py-3 items-center md:grid-cols-[1fr_110px_110px_110px_130px]">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))
            ) : traces.map((trace, index) => (
              <button
                key={trace.traceId}
                type="button"
                onClick={() => openTrace(trace.traceId)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`grid w-full gap-3 border-b px-4 py-3 text-left items-center transition md:grid-cols-[1fr_110px_110px_110px_130px] ${index === selectedIndex ? "bg-primary/10" : "hover:bg-primary/5"}`}
                aria-current={index === selectedIndex}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{trace.name || trace.traceId}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{trace.sessionId || trace.traceId}</p>
                  <TracePromptPreview trace={trace} />
                </div>
                <Badge className="w-fit" variant={statusVariant(trace.status)}>{trace.status}</Badge>
                <span className="font-mono text-sm">{duration(trace.durationMs)}</span>
                <span className="font-mono text-sm">{money(trace.totalCost)}</span>
                <span className="text-xs text-muted-foreground">{new Date(trace.startedAt).toLocaleString()}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </ObservabilityPageShell>
  );
}
