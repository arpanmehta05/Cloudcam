import React, { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, Brain, CircleDollarSign, Sparkles, AlertTriangle } from "@/icons";
import { type AiOverview, type CostResult } from "../../api/ai-observability.api";

interface OverviewCardsProps {
  overview: AiOverview | null;
  costs: CostResult | null;
  dateRange: string;
  loading: boolean;
  bedrockErrorRate: number;
}

function money(value: number | undefined | null) {
  const n = value || 0;
  if (n === 0) return "$0.00";
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function compact(value: number | undefined | null) {
  const n = value || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ElementType;
  loading: boolean;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-secondary/30">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewCards({
  overview,
  costs,
  dateRange,
  loading,
  bedrockErrorRate,
}: OverviewCardsProps) {
  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
      <MetricCard
        title="Requests"
        value={compact(overview?.requestsToday)}
        detail={`${dateRange} observed traffic`}
        icon={Gauge}
        loading={loading}
      />
      <MetricCard
        title="Tokens"
        value={compact(overview?.totalTokensToday)}
        detail="input plus output"
        icon={Brain}
        loading={loading}
      />
      <MetricCard
        title="Spend"
        value={money(overview?.totalCostToday)}
        detail={`${money(costs?.projectedMonthlySpend)} projected month`}
        icon={CircleDollarSign}
        loading={loading}
      />
      <MetricCard
        title="Latency"
        value={`${overview?.avgLatencyToday || 0}ms`}
        detail="weighted average"
        icon={Sparkles}
        loading={loading}
      />
      <MetricCard
        title="Errors"
        value={compact(overview?.errorsToday)}
        detail={`${bedrockErrorRate.toFixed(1)}% Bedrock live error rate`}
        icon={AlertTriangle}
        loading={loading}
      />
    </section>
  );
}
