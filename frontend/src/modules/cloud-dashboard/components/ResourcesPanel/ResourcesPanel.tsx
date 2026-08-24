import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Database, HardDrive, FileText, CheckCircle2, Zap, Loader2 } from "@/icons";
import { cn } from "@/lib/utils";
import { formatBytes } from "../MetricsPanel/ChartConfig";
import { ResourceCard } from "./ResourceCard";

interface ResourcesPanelProps {
  serviceId: string;
  inventory: any;
  insights: any[];
  loading: boolean;
  insightsLoading: boolean;
  serviceConfig: any;
  s3Buckets: any[];
  s3Summary: any;
}

export function ResourcesPanel({
  serviceId,
  inventory,
  insights,
  loading,
  insightsLoading,
  serviceConfig,
  s3Buckets,
  s3Summary,
}: ResourcesPanelProps) {
  // Virtual aggregate services map to underlying inventory keys
  const inventoryItems: any[] = !inventory
    ? []
    : serviceId === "networking"
      ? [...(inventory.alb || []), ...(inventory.cloudfront || [])]
      : serviceId === "security"
        ? inventory.waf || []
        : inventory[serviceId] || [];

  const renderInventoryContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 w-full rounded-lg animate-pulse bg-muted/20"
            />
          ))}
        </div>
      );
    }

    if (serviceId === "s3" && s3Buckets.length > 0) {
      return (
        <div className="space-y-6">
          {s3Summary && (
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "Buckets",
                  value: s3Summary.totalBuckets,
                  icon: Database,
                  color: "text-primary",
                },
                {
                  label: "Total Size",
                  value: formatBytes(s3Summary.totalSizeBytes),
                  icon: HardDrive,
                  color: "text-blue-500",
                },
                {
                  label: "Objects",
                  value: s3Summary.totalObjects?.toLocaleString() || "0",
                  icon: FileText,
                  color: "text-emerald-500",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="p-5 rounded-lg bg-muted/20 border border-border/10"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                      {stat.label}
                    </p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="bg-muted/10 border-b border-border/10">
                <tr>
                  <th className="text-left py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                    Bucket Identity
                  </th>
                  <th className="text-right py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                    Storage
                  </th>
                  <th className="text-right py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                    Objects
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/5">
                {s3Buckets.map((bucket: any, idx: number) => (
                  <tr
                    key={idx}
                    className="group hover:bg-primary/[0.02] transition-colors"
                  >
                    <td className="py-4 px-6 font-mono text-sm font-bold text-foreground/80">
                      {bucket.name}
                    </td>
                    <td className="py-4 px-6 text-right tabular-nums text-sm font-medium text-muted-foreground">
                      {formatBytes(bucket.sizeBytes)}
                    </td>
                    <td className="py-4 px-6 text-right tabular-nums text-sm font-medium text-muted-foreground">
                      {bucket.objectCount?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (serviceId === "ecs" && inventory?.ecs?.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead className="bg-muted/10 border-b border-border/10">
              <tr>
                <th className="text-left py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                  Service Name
                </th>
                <th className="text-left py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                  Context
                </th>
                <th className="text-left py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                  Status
                </th>
                <th className="text-right py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                  Telemetry (Tasks)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {inventory.ecs.map((svc: any, idx: number) => (
                <tr
                  key={idx}
                  className="group hover:bg-primary/[0.02] transition-colors"
                >
                  <td className="py-4 px-6">
                    <p className="font-bold text-sm text-foreground tracking-tight">
                      {svc.name}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 mt-1 border-primary/20 bg-primary/5 text-primary"
                    >
                      {svc.type || "FARGATE"}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-sm font-medium text-muted-foreground">
                    {svc.cluster}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    <Badge
                      variant={svc.status === "ACTIVE" ? "default" : "secondary"}
                      className="h-6 rounded-md px-2 text-xs font-bold"
                    >
                      {svc.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={cn(
                          "text-sm font-bold font-mono",
                          svc.runningTasks < svc.desiredTasks
                            ? "text-yellow-500"
                            : "text-emerald-500"
                        )}
                      >
                        {svc.runningTasks} / {svc.desiredTasks}
                      </span>
                      <div className="w-28 bg-muted/40 h-2 rounded-full overflow-hidden border border-border/5">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            svc.runningTasks < svc.desiredTasks
                              ? "bg-yellow-500"
                              : "bg-emerald-500"
                          )}
                          style={{
                            width: `${(svc.runningTasks / (svc.desiredTasks || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (inventoryItems.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead className="bg-muted/10 border-b border-border/10">
              <tr>
                <th className="text-left py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                  Resource Identity
                </th>
                <th className="text-left py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                  State
                </th>
                <th className="text-left py-4 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                  Technical Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {inventoryItems.map((item: any, idx: number) => (
                <tr
                  key={idx}
                  className="group hover:bg-primary/[0.02] transition-colors"
                >
                  <td className="py-4 px-6 font-mono text-sm font-bold text-foreground/80">
                    {item.name || item.id}
                  </td>
                  <td className="py-4 px-6">
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-bold uppercase tracking-tight",
                        item.state === "running" || item.status === "available"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                          : "bg-muted border-muted-foreground/20 text-muted-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          item.state === "running" || item.status === "available"
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            : "bg-muted-foreground"
                        )}
                      />
                      {item.state || item.status || "active"}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-medium text-muted-foreground italic">
                    {item.type || item.class || item.runtime || "Standard Configuration"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="py-12 text-center flex flex-col items-center gap-3 border border-dashed rounded-lg bg-muted/5">
        <Server className="h-8 w-8 text-muted-foreground opacity-20" />
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          No Active {serviceConfig?.displayName || serviceId} Resources Discovered
        </p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 rounded-lg overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/10 bg-secondary">
          <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase tracking-widest leading-none">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Server className="h-4 w-4" />
            </div>
            Active Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">{renderInventoryContent()}</CardContent>
      </Card>

      <Card className="rounded-lg overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/10 bg-secondary">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-3 uppercase tracking-widest leading-none">
              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                <Zap className="h-5 w-5" />
              </div>
              Cost Guard
            </CardTitle>
            <Badge
              variant="outline"
              className="text-xs px-2.5 py-0.5 font-bold border-yellow-500/20 text-yellow-500 bg-yellow-500/5"
            >
              {insights.length} FOUND
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {insightsLoading ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            </div>
          ) : insights.length > 0 ? (
            <div className="space-y-4">
              {insights.map((insight, idx) => (
                <ResourceCard key={`insight-${idx}`} insight={insight} idx={idx} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center flex flex-col items-center gap-4">
              <div className="p-4 bg-emerald-500/10 rounded-full">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 opacity-60" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">
                  Efficiency Optimized
                </p>
                <p className="text-xs text-muted-foreground mt-2 max-w-[240px] mx-auto font-medium lowercase italic leading-relaxed">
                  No critical waste detected in current service deployment.
                </p>
              </div>
            </div>
          )}
          <Button
            className="w-full mt-5 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary/80 border border-primary/20 font-bold text-xs uppercase tracking-widest h-11 rounded-lg"
            variant="outline"
            onClick={() => {
              window.location.href = "/recommendations";
            }}
          >
            Detailed Infrastructure Analysis
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
