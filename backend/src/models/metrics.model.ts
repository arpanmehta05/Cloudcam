// ─── Prometheus / CloudWatch Metric Models ───

export interface MetricResult {
  metric: Record<string, string>;
  values?: [number, string][];
  value?: [number, string];
}

export interface PrometheusResponse {
  status: string;
  data: {
    resultType: string;
    result: MetricResult[];
  };
}

export interface MetricStats {
  current: number;
  avg: number;
  max: number;
  min: number;
  trend: "increasing" | "decreasing" | "stable";
  datapoints: number;
}

// CloudWatch native types
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface MetricTimeSeries {
  id: string;
  label: string;
  datapoints: TimeSeriesPoint[];
}

export interface CloudWatchMetricQuery {
  namespace: string;
  metricName: string;
  stat: string;
  dimensions?: { Name: string; Value: string }[];
  period?: number;
}
