import React from "react";
import { MetricCard } from "./MetricCard";
import { calcMetricStats } from "./ChartConfig";

interface MetricsPanelProps {
  serviceConfig: {
    displayName: string;
    metrics: Array<{
      name: string;
      namespace: string;
      metricName: string;
      unit: string;
    }>;
  };
  metrics: any;
  loading: boolean;
  range: string;
  diagnostics?: {
    resourceCount: number;
  } | null;
  onCreateAlarm: (metric: any) => void;
}

export function MetricsPanel({
  serviceConfig,
  metrics,
  loading,
  range,
  diagnostics,
  onCreateAlarm,
}: MetricsPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {serviceConfig.metrics.slice(0, 6).map((m) => {
        const mStats = calcMetricStats(metrics?.[m.name]?.data || []);
        return (
          <MetricCard
            key={m.name}
            metricDef={m}
            mStats={mStats}
            metricConfig={metrics?.[m.name]}
            diagnostics={diagnostics}
            loading={loading}
            range={range}
            onCreateAlarm={() =>
              onCreateAlarm({
                name: m.name,
                namespace: m.namespace,
                metricName: m.metricName,
              })
            }
          />
        );
      })}
    </div>
  );
}
