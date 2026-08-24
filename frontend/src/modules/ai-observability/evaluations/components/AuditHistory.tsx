"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "@/icons";

import type { AiEvaluation } from "../types";

interface AuditHistoryProps {
  loading: boolean;
  evaluations: AiEvaluation[];
  expandedEvalId: string | null;
  setExpandedEvalId: (id: string | null) => void;
}

export function AuditHistory({
  loading,
  evaluations,
  expandedEvalId,
  setExpandedEvalId,
}: AuditHistoryProps) {
  return (
    <Card className="border border-border/80 bg-secondary/5">
      <CardHeader>
        <CardTitle className="text-sm">Audit Log History</CardTitle>
        <CardDescription className="text-xs">Timeline of completed LLM-as-a-Judge audits</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : evaluations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            No evaluations run yet. Audited entries appear once requests are sampled or manually audited.
          </div>
        ) : (
          <div className="space-y-3">
            {evaluations.map((evalItem) => {
              const isExpanded = expandedEvalId === evalItem._id;
              return (
                <div key={evalItem._id} className="border border-border p-3 hover:bg-secondary/10 transition-colors">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedEvalId(isExpanded ? null : evalItem._id)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90 text-indigo-400" : "text-muted-foreground"}`} />
                      <span className="text-[10px] font-mono text-muted-foreground">Req: {evalItem.requestId?.slice(0, 16)}...</span>
                      <Badge variant="outline" className="text-[9px] font-mono">{evalItem.judgeModel}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={evalItem.status === "pass" ? "default" : "destructive"} className="text-[9px] font-mono px-2 py-0">
                        {evalItem.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-mono font-bold">{evalItem.score}/100</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-border space-y-3 animate-fade-in text-xs">
                      <div>
                        <span className="font-semibold text-[10px] font-mono uppercase text-muted-foreground tracking-widest block mb-1">Judge Reasoning</span>
                        <p className="text-muted-foreground leading-relaxed">{evalItem.reasoning || "No reasoning details available"}</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {evalItem.metrics?.map((m) => (
                          <div key={m.name} className="bg-secondary/10 p-2 border border-border/60">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold capitalize text-[10px] text-muted-foreground">{m.name}</span>
                              <Badge variant={m.passed ? "default" : "destructive"} className="text-[8px] px-1 py-0">{m.passed ? "PASS" : "FAIL"}</Badge>
                            </div>
                            <span className="text-sm font-semibold font-mono">{m.score}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
