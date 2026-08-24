import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BellRing } from "@/icons";
import { type AiAlertRow, type Anomaly } from "../../api/ai-observability.api";

interface AlertsListProps {
  openAlerts: AiAlertRow[];
  anomalies: Anomaly[];
}

function statusTone(value: string) {
  if (["critical", "high", "error"].includes(value)) return "text-red-500";
  if (["medium", "warning"].includes(value)) return "text-amber-500";
  return "text-muted-foreground";
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function AlertsList({ openAlerts, anomalies }: AlertsListProps) {
  const combined = [...openAlerts, ...anomalies.slice(0, 2)];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-primary" />
          Active Risks
        </CardTitle>
        <CardDescription>Alerts and detected anomalies that need attention.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {combined.length ? (
          combined.map((item: any, index) => (
            <div key={item._id || `${item.type}-${index}`} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className={`text-sm font-medium ${statusTone(item.severity || "medium")}`}>{item.title}</p>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {item.severity || item.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
            </div>
          ))
        ) : (
          <EmptyState text="No active alerts or anomalies." />
        )}
      </CardContent>
    </Card>
  );
}
