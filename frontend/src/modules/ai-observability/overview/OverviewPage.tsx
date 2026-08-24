"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, RefreshCw, GitBranch, Plug } from "@/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAiObservabilityFilters } from "@/hooks/useAiObservabilityFilters";

import { useOverviewMetrics } from "./hooks/useOverviewMetrics";
import { useOverviewAlerts } from "./hooks/useOverviewAlerts";
import { type BedrockConsoleMetrics } from "../api/ai-observability.api";

import { FilterBar } from "../components/FilterBar";
import { OverviewCards } from "./components/OverviewCards";
import { TraceViewer } from "./components/TraceViewer";
import { BedrockConsole } from "./components/BedrockConsole";
import { CostTimeline } from "./components/CostTimeline";
import { TokenChart } from "./components/TokenChart";
import { AlertsList } from "./components/AlertsList";
import { RoutingRecommendations } from "./components/RoutingRecommendations";
import { PromptInsights } from "./components/PromptInsights";
import { ModelMix } from "./components/ModelMix";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CircleDollarSign } from "@/icons";

export function OverviewPage() {
  const { dateRange, setDateRange, provider, setProvider, reset } = useAiObservabilityFilters({ dateRange: "7d" });
  const {
    loading,
    lastUpdated,
    overview,
    tokens,
    costs,
    models,
    routing,
    promptInsights,
    latestTraces,
    refresh,
  } = useOverviewMetrics(provider, dateRange);

  const { alerts, anomalies } = useOverviewAlerts();
  const [bedrockMetrics, setBedrockMetrics] = useState<BedrockConsoleMetrics | null>(null);

  const tokenChart = useMemo(() => tokens.map((row) => ({
    label: new Date(row.date).toLocaleDateString([], { month: "short", day: "numeric" }),
    input: row.promptTokens,
    output: row.completionTokens,
    total: row.totalTokens,
  })), [tokens]);

  const costChart = useMemo(() => (costs?.dailyTrend || []).map((row) => ({
    label: new Date(row.date).toLocaleDateString([], { month: "short", day: "numeric" }),
    cost: row.cost,
  })), [costs]);

  const openAlerts = useMemo(() => alerts.filter((item) => item.status !== "resolved").slice(0, 4), [alerts]);
  const topModels = useMemo(() => models.slice().sort((a, b) => b.totalCost - a.totalCost).slice(0, 5), [models]);
  const activeFilterCount = (dateRange !== "7d" ? 1 : 0) + (provider !== "all" ? 1 : 0);
  const bedrockErrorRate = bedrockMetrics?.cards.errorRatePct || 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-secondary/40">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Observability</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Bedrock and multi-provider cost, routing, prompt, trace, and alert control center.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="hidden text-xs text-muted-foreground sm:inline">Updated {lastUpdated}</span>}
          <Link href="/ai-observability/traces">
            <Button size="sm" variant="outline">
              <GitBranch className="mr-2 h-4 w-4" />
              Trace Explorer
            </Button>
          </Link>
          <Link href="/settings/ai-observability">
            <Button size="sm" variant="outline">
              <Plug className="mr-2 h-4 w-4" />
              Connect app
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        provider={provider}
        onProviderChange={setProvider}
        showSearch={false}
        showStatus={false}
        onReset={reset}
        activeFilterCount={activeFilterCount}
      />

      <OverviewCards
        overview={overview}
        costs={costs}
        dateRange={dateRange}
        loading={loading}
        bedrockErrorRate={bedrockErrorRate}
      />

      <TraceViewer latestTraces={latestTraces} />

      <BedrockConsole
        preferredWindow={dateRange === "24h" ? "24h" : "12h"}
        onMetricsChange={setBedrockMetrics}
      />

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDollarSign className="h-4 w-4 text-primary" />
              Spend and Token Trend
            </CardTitle>
            <CardDescription>
              Stored provider events from OpenAI, Anthropic, Gemini, NVIDIA NIM, Bedrock, and custom sources.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <CostTimeline costChart={costChart} />
            <TokenChart tokenChart={tokenChart} />
          </CardContent>
        </Card>
        <AlertsList openAlerts={openAlerts} anomalies={anomalies} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <RoutingRecommendations routing={routing} />
        <PromptInsights promptInsights={promptInsights} />
      </section>

      <section className="grid gap-6 xl:grid-cols-1">
        <ModelMix topModels={topModels} />
      </section>
    </div>
  );
}
