import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Brain } from "@/icons";
import { type ModelRow } from "../../api/ai-observability.api";

interface ModelMixProps {
  topModels: ModelRow[];
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

export function ModelMix({ topModels }: ModelMixProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          Model Mix
        </CardTitle>
        <CardDescription>Highest-cost models in the selected window.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {topModels.length ? (
          topModels.map((model) => (
            <div
              key={`${model.provider}-${model.model}`}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium">{model.model}</p>
                <p className="text-xs text-muted-foreground">
                  {model.provider} - {compact(model.totalTokens)} tokens - {model.avgLatency}ms
                </p>
              </div>
              <span className="text-sm font-semibold">{money(model.totalCost)}</span>
            </div>
          ))
        ) : (
          <EmptyState text="No model performance data yet." />
        )}
      </CardContent>
    </Card>
  );
}
