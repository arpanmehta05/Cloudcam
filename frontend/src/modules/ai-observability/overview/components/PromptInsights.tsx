import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wand2 } from "@/icons";
import { type PromptInsight } from "../../api/ai-observability.api";

interface PromptInsightsProps {
  promptInsights: PromptInsight[];
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function PromptInsights({ promptInsights }: PromptInsightsProps) {
  const promptSavings = promptInsights.reduce((sum, item) => sum + item.estimatedCostSavings, 0);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4 text-primary" />
          Prompt Compression Insights
        </CardTitle>
        <CardDescription>Large fixed prompts, duplicated context, and prompt/output imbalance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border bg-secondary/20 p-3">
          <span className="text-sm text-muted-foreground">Estimated monthly prompt savings</span>
          <span className="text-lg font-semibold">{money(promptSavings)}</span>
        </div>
        {promptInsights.length ? (
          promptInsights.slice(0, 5).map((insight) => (
            <div key={`${insight.endpoint}-${insight.insightType}`} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {insight.endpoint || insight.serviceName || "unknown endpoint"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{insight.message}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {insight.insightType.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {compact(insight.estimatedTokenSavings)} tokens/mo, {money(insight.estimatedCostSavings)} saved
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="No prompt compression insights yet." />
        )}
      </CardContent>
    </Card>
  );
}
