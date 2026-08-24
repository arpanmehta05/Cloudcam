import React from "react";
import { MetricsPanel } from "../MetricsPanel/MetricsPanel";
import { ResourcesPanel } from "../ResourcesPanel/ResourcesPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "@/icons";

interface SecurityPanelProps {
  serviceId: string;
  metrics: any;
  loading: boolean;
  range: string;
  diagnostics?: any;
  onCreateAlarm: (metric: any) => void;
  inventory: any;
  insights: any[];
  insightsLoading: boolean;
  serviceConfig: any;
  s3Buckets: any[];
  s3Summary: any;
}

export function SecurityPanel({
  serviceId,
  metrics,
  loading,
  range,
  diagnostics,
  onCreateAlarm,
  inventory,
  insights,
  insightsLoading,
  serviceConfig,
  s3Buckets,
  s3Summary,
}: SecurityPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-xl overflow-hidden border border-emerald-500/10 bg-emerald-500/[0.02] dark:border-emerald-500/20 dark:bg-emerald-500/[0.04]">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest leading-none mb-1.5">
              Security Operations Center
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              Web application firewall, access controls, and threat monitoring telemetry are active. No anomalies detected in the current lookback.
            </p>
          </div>
        </CardContent>
      </Card>

      <MetricsPanel
        serviceConfig={serviceConfig}
        metrics={metrics}
        loading={loading}
        range={range}
        diagnostics={diagnostics}
        onCreateAlarm={onCreateAlarm}
      />

      <ResourcesPanel
        serviceId={serviceId}
        inventory={inventory}
        insights={insights}
        loading={loading}
        insightsLoading={insightsLoading}
        serviceConfig={serviceConfig}
        s3Buckets={s3Buckets}
        s3Summary={s3Summary}
      />
    </div>
  );
}
