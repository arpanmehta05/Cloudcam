"use client";

import { Badge } from "@/components/ui/badge";
import { OPENAI_PRICING, formatNumber } from "./shared";

interface KeyTableProps {
  byApiKey: any[];
}

export function KeyTable({ byApiKey }: KeyTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-2 px-3">Key Name</th>
            <th className="text-left py-2 px-3">Models Used</th>
            <th className="text-right py-2 px-3">Input</th>
            <th className="text-right py-2 px-3">Output</th>
            <th className="text-right py-2 px-3">Cached</th>
            <th className="text-right py-2 px-3">Requests</th>
            <th className="text-right py-2 px-3">Est. Cost</th>
          </tr>
        </thead>
        <tbody>
          {byApiKey.map((k: any, i: number) => {
            let estCost = 0;
            Object.entries(k.models || {}).forEach(([model, usage]: [string, any]) => {
              const p = OPENAI_PRICING[model];
              if (p) estCost += (usage.input / 1e6) * p.input + (usage.output / 1e6) * p.output;
            });
            return (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="py-2 px-3 text-foreground">
                  <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                    {k.apiKeyName || k.apiKeyId}
                  </code>
                </td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(k.models || {}).map((m: string) => (
                      <Badge key={m} variant="outline" className="font-mono text-[9px]">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="text-right py-2 px-3">{formatNumber(k.totalInput)}</td>
                <td className="text-right py-2 px-3">{formatNumber(k.totalOutput)}</td>
                <td className="text-right py-2 px-3 text-muted-foreground">
                  {k.totalCached > 0 ? formatNumber(k.totalCached) : "—"}
                </td>
                <td className="text-right py-2 px-3">{formatNumber(k.totalRequests)}</td>
                <td className="text-right py-2 px-3 text-emerald-400">
                  {estCost > 0 ? `$${estCost.toFixed(4)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
