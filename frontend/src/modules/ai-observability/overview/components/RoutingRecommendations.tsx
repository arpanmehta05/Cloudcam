import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, GitBranch } from "@/icons";
import { type RoutingRecommendation } from "../../api/ai-observability.api";

interface RoutingRecommendationsProps {
  routing: { recommendations: RoutingRecommendation[]; totalMonthlySavings: number } | null;
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

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function RoutingRecommendations({ routing }: RoutingRecommendationsProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" />
          Model Routing Recommendations
        </CardTitle>
        <CardDescription>Suggested lower-cost routes for repeatable workloads.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border bg-secondary/20 p-3">
          <span className="text-sm text-muted-foreground">Estimated monthly savings</span>
          <span className="text-lg font-semibold text-green-600">
            {money(routing?.totalMonthlySavings)}
          </span>
        </div>
        {routing?.recommendations.length ? (
          routing.recommendations.slice(0, 5).map((rec) => (
            <div key={`${rec.endpoint}-${rec.currentModel}-${rec.suggestedModel}`} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{rec.endpoint || "unknown endpoint"}</Badge>
                <span className="text-muted-foreground">{rec.currentModel}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{rec.suggestedModel}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {rec.requestsAffected.toLocaleString()} requests, {pct(rec.confidence)} confidence
                </span>
                <span className="font-medium text-green-600">{money(rec.monthlySavings)}/mo</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rec.ruleTriggered}</p>
            </div>
          ))
        ) : (
          <EmptyState text="No routing changes yet. Add more endpoint-level traffic." />
        )}
      </CardContent>
    </Card>
  );
}
