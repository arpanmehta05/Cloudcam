"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  AlertTriangle,
  AlertCircle,
  Info,
  Calculator,
  X,
  ChevronDown,
} from "@/icons";
import { authFetch } from "@/lib/auth-fetch";
import { Badge } from "@/components/ui/badge";
import type { ServiceId } from "../../types";

export interface CostNodeInput {
  id: string;
  serviceId: ServiceId;
  config: Record<string, unknown>;
}

export interface CostEdgeInput {
  source: string;
  target: string;
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

interface CostWarning {
  code: string;
  message: string;
  node: string;
  severity: "info" | "warning" | "error";
}

interface CostResult {
  totalMonthlyCost: number;
  currency: string;
  engine: "infracost" | "price-list" | "fallback";
  breakdown: CostBreakdown[];
  warnings: CostWarning[];
  cached: boolean;
  estimatedAt: string;
}

interface FloatingCostBoxProps {
  nodes: CostNodeInput[];
  edges: CostEdgeInput[];
  region: string;
  sessionId: string;
}

const DEBOUNCE_MS = 800;

export function FloatingCostBox({
  nodes,
  edges,
  region,
  sessionId,
}: FloatingCostBoxProps) {
  const [result, setResult] = useState<CostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchCost = useCallback(async () => {
    if (nodes.length === 0) {
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/api/simulation/cost/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          region,
          sessionId,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError("Failed to estimate cost");
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, region, sessionId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (nodes.length === 0) {
      setResult(null);
      return;
    }
    debounceRef.current = setTimeout(fetchCost, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, edges, fetchCost]);

  const engineLabel = result?.engine === "infracost" ? "Live" : "Estimate";
  const engineColor =
    result?.engine === "infracost"
      ? "bg-[#DCFCE7] text-[#14532D] dark:bg-[#052E16] dark:text-[#86EFAC] border-[#22C55E]"
      : "bg-[#FEF3C7] text-[#14532D] dark:bg-[#451A03] dark:text-[#FDBA74] border-[#F59E0B]";

  if (nodes.length === 0 && !result) return null;

  return (
    <div className="fixed right-4 top-24 z-[70] flex flex-col items-end gap-2 sm:right-6">
      {/* Summary pill */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="simulation-card flex items-center gap-3 rounded-lg px-4 py-2.5"
      >
        {loading ? (
          <>
            <Calculator className="h-4 w-4 animate-spin text-[#64748B] dark:text-[#94A3B8]" />
            <span className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
              Calculating...
            </span>
          </>
        ) : error ? (
          <>
            <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
            <span className="text-sm font-bold text-[#EF4444]">{error}</span>
          </>
        ) : result ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <DollarSign className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold leading-tight text-foreground">
                ${result.totalMonthlyCost.toFixed(2)}
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                monthly
              </span>
            </div>
            <Badge
              variant="outline"
              className={`ml-2 border ${engineColor} text-[10px] px-1.5 py-0`}
            >
              {engineLabel}
            </Badge>
            {result.warnings.length > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="ml-1 rounded p-1 text-[#F59E0B] transition hover:bg-[#FEF3C7] dark:hover:bg-[#451A03]"
              >
                <AlertTriangle className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label="Show cost breakdown"
              onClick={() => setExpanded(!expanded)}
              className="ml-1 rounded p-1 text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#13233A] dark:hover:text-white"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </>
        ) : null}
      </motion.div>

      {/* Expanded breakdown */}
      <AnimatePresence>
        {expanded && result && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="simulation-card w-[min(340px,calc(100vw-2rem))] rounded-lg flex flex-col overflow-hidden max-h-[30rem]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#22C55E]" />
                <span className="text-sm font-extrabold text-foreground">
                  Cost Breakdown
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-4 px-5 py-4">
                {/* Per-node costs */}
                {result.breakdown.map((b) => (
                  <div
                    key={b.service}
                    className="simulation-card-subtle rounded-lg p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                          {b.serviceName}
                        </span>
                        {!b.supported && (
                          <Badge
                            variant="outline"
                            className="border-[#CBD5E1] bg-white text-[9px] text-[#64748B] dark:border-[#334155] dark:bg-[#0B1728] dark:text-[#94A3B8]"
                          >
                            estimated
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                        ${b.monthlyCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {b.components.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]"
                        >
                          <span>{c.name}</span>
                          <span>${c.monthlyCost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <>
                    <div className="border-t border-[#E2E8F0] pt-4 dark:border-[#1E293B]">
                      <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#64748B] dark:text-[#94A3B8]">
                        Warnings
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      {result.warnings.map((w, i) => {
                        const Icon =
                          w.severity === "error"
                            ? AlertCircle
                            : w.severity === "warning"
                              ? AlertTriangle
                              : Info;
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[11px] font-medium leading-relaxed transition-all duration-200 ${
                              w.severity === "error"
                                ? "border-red-500/15 bg-red-500/5 text-red-600 dark:text-red-400 dark:border-red-500/10"
                                : w.severity === "warning"
                                  ? "border-amber-500/15 bg-amber-500/5 text-amber-600 dark:text-amber-400 dark:border-amber-500/10"
                                  : "border-blue-500/15 bg-blue-500/5 text-blue-600 dark:text-blue-400 dark:border-blue-500/10"
                            }`}
                          >
                            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-95" />
                            <span className="flex-1">{w.message}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#E2E8F0] px-5 py-3 dark:border-[#1E293B] shrink-0">
              <p className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                Engine: {engineLabel} pricing &middot; Est.{" "}
                {new Date(result.estimatedAt).toLocaleTimeString()}
                {result.cached && " (cached)"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
