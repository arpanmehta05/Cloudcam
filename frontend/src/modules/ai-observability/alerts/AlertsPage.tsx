"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle, CheckSquare, Eye, RefreshCw, Zap } from "@/icons";
import { evaluateAlerts, patchAlert } from "./api";
import { useAlerts } from "./hooks/useAlerts";

function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "text-red-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "cost_spike":
      return "Cost Spike";
    case "token_spike":
      return "Token Spike";
    case "error_spike":
      return "Error Spike";
    case "latency_spike":
      return "Latency Spike";
    case "budget_limit":
      return "Budget Limit";
    case "bill_shock":
      return "Bill Shock Alert";
    case "new_model":
      return "New Model Detected";
    case "error_cost":
      return "High Error Cost";
    default:
      return type;
  }
}

export default function AlertsPage() {
  const { loading, alerts, setAlerts } = useAlerts();
  const [filter, setFilter] = useState<string>("active");
  const [acting, setActing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [evaluating, setEvaluating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const stats = useMemo(() => {
    const open = alerts.filter((a) => a.status === "open").length;
    const acknowledged = alerts.filter((a) => a.status === "acknowledged").length;
    const resolved = alerts.filter((a) => a.status === "resolved").length;
    return { open, acknowledged, resolved, active: open + acknowledged, total: alerts.length };
  }, [alerts]);

  // "Active" is the working view (open + acknowledged). Resolved alerts move to
  // "Archive", where the backend auto-deletes them 3 months after resolution.
  const visibleAlerts = useMemo(() => {
    if (filter === "active") return alerts.filter((alert) => alert.status !== "resolved");
    if (filter === "archive") return alerts.filter((alert) => alert.status === "resolved");
    return alerts.filter((alert) => alert.status === filter);
  }, [alerts, filter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllUnresolved() {
    const ids = alerts.filter((a) => a.status !== "resolved").map((a) => a._id);
    setSelected(new Set(ids));
  }

  async function handleAction(
    alertId: string,
    action: "acknowledged" | "resolved",
  ) {
    setActing(alertId);
    try {
      const updated = await patchAlert(alertId, action);
      setAlerts((prev) => prev.map((a) => (a._id === alertId ? updated : a)));
    } catch (err) {
      console.error("Failed to update alert:", err);
    } finally {
      setActing(null);
    }
  }

  async function handleEvaluate() {
    setEvaluating(true);
    setNotice(null);
    try {
      const result = await evaluateAlerts();
      setAlerts(result.alerts);
      setSelected(new Set());
      setNotice(
        result.unavailable
          ? "Alert evaluation endpoint is not available on the running backend yet. Showing the latest saved alerts."
          : result.createdCount > 0
            ? `${result.createdCount} new alert${result.createdCount === 1 ? "" : "s"} created.`
            : "Alert rules evaluated. No new alerts were created.",
      );
    } catch (err) {
      console.error("Failed to evaluate alerts:", err);
      setNotice(
        "Alert evaluation failed. Existing saved alerts are still shown below.",
      );
    } finally {
      setEvaluating(false);
    }
  }

  async function bulkAction(action: "acknowledged" | "resolved") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setActing("bulk");
    try {
      for (const id of ids) {
        const updated = await patchAlert(id, action);
        setAlerts((prev) => prev.map((a) => (a._id === id ? updated : a)));
      }
      setSelected(new Set());
    } catch (err) {
      console.error("Bulk action failed:", err);
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <header className="flex items-center gap-3 pb-4 border-b border-border mb-5">
        <Zap className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-lg font-display font-bold tracking-tight">
            Alert Manager
          </h1>
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            AI observability alerts
          </p>
        </div>
      </header>

      {/* Filter + Actions Bar */}
      <div className="flex items-center gap-3 flex-wrap pb-4">
        {/* Status Tabs */}
        <div className="flex items-center bg-secondary p-1 gap-0.5">
          {[
            { v: "active", l: `Active (${stats.active})` },
            { v: "open", l: `Open (${stats.open})` },
            { v: "acknowledged", l: `Ack'd (${stats.acknowledged})` },
            { v: "archive", l: `Archive (${stats.resolved})` },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                filter === f.v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          disabled={evaluating || loading}
          onClick={handleEvaluate}
          className="h-8 text-xs font-mono gap-1"
        >
          <RefreshCw
            className={`w-3 h-3 ${evaluating ? "animate-spin" : ""}`}
          />
          Evaluate Now
        </Button>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-mono">
              {selected.size} selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={acting === "bulk"}
              onClick={() => bulkAction("acknowledged")}
              className="h-8 text-xs font-mono gap-1"
            >
              <Eye className="w-3 h-3" />
              Ack All
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={acting === "bulk"}
              onClick={() => bulkAction("resolved")}
              className="h-8 text-xs font-mono gap-1"
            >
              <CheckCircle className="w-3 h-3" />
              Resolve All
            </Button>
          </div>
        )}

        {alerts.some((a) => a.status !== "resolved") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAllUnresolved}
            className="h-8 text-xs font-mono gap-1"
          >
            <CheckSquare className="w-3 h-3" />
            Select All
          </Button>
        )}
      </div>

      {notice && (
        <div className="mb-4 border border-border bg-secondary/10 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          {filter === "archive" && (
            <div className="mb-3 border border-border bg-secondary/10 px-3 py-2 text-[11px] text-muted-foreground">
              Resolved alerts are archived here and automatically deleted 3 months after resolution.
            </div>
          )}
          {loading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : visibleAlerts.length === 0 ? (
            <div className="text-center py-16">
              <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === "active"
                  ? "No active alerts."
                  : filter === "archive"
                    ? "Archive is empty."
                    : `No ${filter} alerts.`}
              </p>
              {filter !== "archive" && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Use Evaluate Now to check cost, token, error rate, latency, and
                  budget rules.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleAlerts.map((alert) => {
                const isSelected = selected.has(alert._id);
                return (
                  <div
                    key={alert._id}
                    className={`border p-4 transition-all ${
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : alert.status === "resolved"
                          ? "border-border/50 bg-secondary/5 opacity-60"
                          : alert.status === "open"
                            ? "border-border bg-secondary/15"
                            : "border-border bg-secondary/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {alert.status !== "resolved" && (
                        <button
                          className={`w-4 h-4 border mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => toggleSelect(alert._id)}
                        >
                          {isSelected && (
                            <CheckCircle className="w-3 h-3 text-primary-foreground" />
                          )}
                        </button>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p
                            className={`text-xs font-medium ${severityColor(alert.severity)}`}
                          >
                            {alert.title}
                          </p>
                          <Badge variant="outline" className="text-[9px]">
                            {typeLabel(alert.type)}
                          </Badge>
                          <Badge
                            variant={
                              alert.status === "open"
                                ? "destructive"
                                : alert.status === "acknowledged"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[9px]"
                          >
                            {alert.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase"
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-2">
                          {new Date(alert.createdAt).toLocaleString()}
                          {alert.resolvedAt &&
                            ` • Resolved: ${new Date(alert.resolvedAt).toLocaleString()}`}
                        </p>
                      </div>

                      {alert.status !== "resolved" && (
                        <div className="flex items-center gap-2 shrink-0">
                          {alert.status === "open" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={acting === alert._id}
                              onClick={() =>
                                handleAction(alert._id, "acknowledged")
                              }
                              className="h-7 text-[10px] font-mono gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Ack
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={acting === alert._id}
                            onClick={() => handleAction(alert._id, "resolved")}
                            className="h-7 text-[10px] font-mono gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
