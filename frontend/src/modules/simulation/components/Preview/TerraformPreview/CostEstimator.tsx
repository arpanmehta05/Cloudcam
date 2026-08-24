"use client";

import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { DollarSign, AlertTriangle, Calculator, RefreshCw } from "@/icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface CostEstimatorProps {
  nodes: any[];
  edges: any[];
  region: string;
  provider: string;
}

interface CostBreakdown {
  service: string;
  serviceName: string;
  monthlyCost: number;
  components: Array<{
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    monthlyCost: number;
  }>;
  supported: boolean;
}

interface CostResult {
  totalMonthlyCost: number;
  currency: string;
  engine: string;
  breakdown: CostBreakdown[];
  warnings: any[];
}

export function CostEstimator({ nodes, edges, region, provider }: CostEstimatorProps) {
  const [result, setResult] = useState<CostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCost = useCallback(async () => {
    if (nodes.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/simulation/cost/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.filter(n => n.data?.serviceId).map(n => ({
            id: n.id,
            serviceId: n.data?.serviceId,
            config: n.data?.config
          })),
          edges: edges.map(e => ({ source: e.source, target: e.target })),
          region,
          sessionId: "local"
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError("Failed to calculate cost details.");
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, region]);

  useEffect(() => {
    fetchCost();
  }, [fetchCost]);

  if (nodes.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground font-sans">
          Monthly Cost Prediction
        </h3>
        {result && (
          <Badge variant="secondary" className="text-[10px] font-bold">
            Total: ${result.totalMonthlyCost.toFixed(2)}/mo
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs font-semibold">
          <Calculator className="h-4 w-4 animate-spin" />
          <span>Estimating monthly expenses...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-500 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : result ? (
        <div className="grid gap-3 select-text">
          {result.breakdown.map((b) => (
            <Card key={b.service} className="simulation-card-subtle p-3.5 rounded-xl border border-border/40 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                    <DollarSign className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-extrabold text-foreground">
                    {b.serviceName}
                  </span>
                </div>
                <span className="text-xs font-black text-foreground">
                  ${b.monthlyCost.toFixed(2)}
                </span>
              </div>
              {b.components && b.components.length > 0 && (
                <div className="pl-7 space-y-1">
                  {b.components.map((c, i) => (
                    <div key={i} className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                      <span>{c.name}</span>
                      <span>${c.monthlyCost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-muted-foreground italic">
          No cost breakdown available.
        </div>
      )}
    </div>
  );
}
