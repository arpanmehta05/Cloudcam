"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle } from "@/icons";

interface ModelExecutionState {
  provider: string;
  model: string;
  endpoint: string;
  temperature: number;
  maxTokens: number;
  loading: boolean;
  output: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  error: string;
}

interface ResultsComparisonProps {
  compareMode: boolean;
  modelA: ModelExecutionState;
  modelB: ModelExecutionState;
}

export function ResultsComparison({
  compareMode,
  modelA,
  modelB,
}: ResultsComparisonProps) {
  return (
    <div className={`grid grid-cols-1 ${compareMode ? "md:grid-cols-2" : ""} gap-6`}>
      <Card
        className={`border ${
          modelA.loading
            ? "border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
            : "border-border/80"
        } bg-secondary/5 backdrop-blur-md rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[350px] transition-all`}
      >
        <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-border/40 bg-secondary/10">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[9px] font-bold text-indigo-400 border-indigo-400/45 bg-indigo-500/5 px-1.5 py-0.5 rounded"
            >
              Model A
            </Badge>
            <span className="text-xs font-semibold text-foreground/90">{modelA.model}</span>
          </div>
          {modelA.latencyMs > 0 && (
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0.5 bg-secondary/50 border border-border/40 rounded"
            >
              {modelA.latencyMs}ms
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-4 flex-1 flex flex-col justify-between">
          <div className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/95 overflow-y-auto max-h-[400px] flex-1 select-text font-medium">
            {modelA.loading ? (
              <div className="flex flex-col gap-2 pt-20 items-center justify-center text-muted-foreground animate-pulse">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-[10px] tracking-wider">Running Inference...</span>
              </div>
            ) : modelA.error ? (
              <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{modelA.error}</span>
              </div>
            ) : modelA.output ? (
              modelA.output
            ) : (
              <div className="h-full flex items-center justify-center py-20 text-muted-foreground/30 italic text-center text-xs">
                Response output will appear here after execution...
              </div>
            )}
          </div>

          {modelA.usage.totalTokens > 0 && !modelA.loading && (
            <div className="border-t border-border/30 pt-3 mt-4 flex items-center justify-between text-[10px] text-muted-foreground/85">
              <span>
                Prompt: <strong className="text-foreground/85">{modelA.usage.promptTokens}t</strong>
              </span>
              <span>
                Completion:{" "}
                <strong className="text-foreground/85">{modelA.usage.completionTokens}t</strong>
              </span>
              <span className="text-indigo-400 font-bold border-l border-border/50 pl-3">
                Total: {modelA.usage.totalTokens}t
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model B Output Card */}
      {compareMode && (
        <Card
          className={`border ${
            modelB.loading
              ? "border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              : "border-border/80"
          } bg-secondary/5 backdrop-blur-md rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[350px] transition-all`}
        >
          <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-border/40 bg-secondary/10">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[9px] font-bold text-emerald-400 border-emerald-400/45 bg-emerald-500/5 px-1.5 py-0.5 rounded"
              >
                Model B
              </Badge>
              <span className="text-xs font-semibold text-foreground/90">{modelB.model}</span>
            </div>
            {modelB.latencyMs > 0 && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0.5 bg-secondary/50 border border-border/40 rounded"
              >
                {modelB.latencyMs}ms
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-between">
            <div className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/95 overflow-y-auto max-h-[400px] flex-1 select-text font-medium">
              {modelB.loading ? (
                <div className="flex flex-col gap-2 pt-20 items-center justify-center text-muted-foreground animate-pulse">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  <span className="text-[10px] tracking-wider">Running Inference...</span>
                </div>
              ) : modelB.error ? (
                <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modelB.error}</span>
                </div>
              ) : modelB.output ? (
                modelB.output
              ) : (
                <div className="h-full flex items-center justify-center py-20 text-muted-foreground/30 italic text-center text-xs">
                  Response output will appear here after execution...
                </div>
              )}
            </div>

            {modelB.usage.totalTokens > 0 && !modelB.loading && (
              <div className="border-t border-border/30 pt-3 mt-4 flex items-center justify-between text-[10px] text-muted-foreground/85">
                <span>
                  Prompt: <strong className="text-foreground/85">{modelB.usage.promptTokens}t</strong>
                </span>
                <span>
                  Completion:{" "}
                  <strong className="text-foreground/85">{modelB.usage.completionTokens}t</strong>
                </span>
                <span className="text-emerald-400 font-bold border-l border-border/50 pl-3">
                  Total: {modelB.usage.totalTokens}t
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
