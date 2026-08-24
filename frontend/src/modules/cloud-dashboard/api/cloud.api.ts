import { authFetchJson } from "@/lib/auth-fetch";

export interface BillingResponse {
  success: boolean;
  error?: string;
  warnings?: string[];
  warning?: string;
  data?: any[];
  summary?: {
    mtdSpend: number;
    currentSpend: number;
    projectedTotal: number;
    unit: string;
    range: string;
    currentSpendUnit?: string;
  };
  mtdBreakdown?: Array<{
    service: string;
    amount: number;
  }>;
  history?: any[];
}

export interface AlarmsResponse {
  success: boolean;
  error?: string;
  counts?: {
    total: number;
    alarm: number;
    ok: number;
    insufficient: number;
  };
  alarms?: any[];
}

export interface MetricsResponse {
  success: boolean;
  error?: string;
  metrics: any;
  buckets?: any[];
  summary?: any;
  diagnostics?: {
    resourceCount: number;
  };
}

export interface ResourcesResponse {
  success: boolean;
  error?: string;
  inventory: any;
}

export interface InsightsResponse {
  success: boolean;
  error?: string;
  recommendations?: any[];
}

export interface LogsResponse {
  success: boolean;
  error?: string;
  logs?: any[];
  hasLogs?: boolean;
}

export const cloudApi = {
  getBilling: (provider: string, range: string, forceRefresh = true): Promise<BillingResponse> => {
    const forceRefreshParam = forceRefresh ? "&forceRefresh=true" : "";
    const url =
      provider === "all"
        ? `/api/cloud/billing?provider=all&range=${range}${forceRefreshParam}`
        : `/api/${provider}/billing?range=${range}${forceRefreshParam}`;
    return authFetchJson<BillingResponse>(url, undefined, forceRefresh ? { headers: { "x-rabbittwatch-cache-bypass": "true" } } : undefined);
  },

  getAlarms: (provider: string, region: string, forceRefresh = true): Promise<AlarmsResponse> => {
    const forceRefreshParam = forceRefresh ? "&forceRefresh=true" : "";
    const url = `/api/${provider}/alarms?region=${encodeURIComponent(region)}${forceRefreshParam}`;
    return authFetchJson<AlarmsResponse>(url, undefined, forceRefresh ? { headers: { "x-rabbittwatch-cache-bypass": "true" } } : undefined);
  },

  getMetrics: (provider: string, serviceId: string, range: string, region: string, forceRefresh = true): Promise<MetricsResponse> => {
    const params = new URLSearchParams({
      service: serviceId,
      range,
      region,
    });
    if (forceRefresh) params.set("forceRefresh", "true");
    const url = `/api/${provider}/metrics?${params.toString()}`;
    return authFetchJson<MetricsResponse>(url, undefined, forceRefresh ? { headers: { "x-rabbittwatch-cache-bypass": "true" } } : undefined);
  },

  getResources: (provider: string, region: string, forceRefresh = true): Promise<ResourcesResponse> => {
    const params = new URLSearchParams({ region });
    if (forceRefresh) params.set("forceRefresh", "true");
    const url = `/api/${provider}/resources?${params.toString()}`;
    return authFetchJson<ResourcesResponse>(url, undefined, forceRefresh ? { headers: { "x-rabbittwatch-cache-bypass": "true" } } : undefined);
  },

  getInsights: (provider: string, region: string, forceRefresh = true): Promise<InsightsResponse> => {
    const forceRefreshParam = forceRefresh ? "&forceRefresh=true" : "";
    const url = `/api/${provider}/insights?region=${encodeURIComponent(region)}${forceRefreshParam}`;
    return authFetchJson<InsightsResponse>(url, undefined, forceRefresh ? { headers: { "x-rabbittwatch-cache-bypass": "true" } } : undefined);
  },

  getLogs: (
    provider: string,
    serviceId: string,
    rangeSeconds: number,
    region: string,
    resourceId?: string,
    forceRefresh = true
  ): Promise<LogsResponse> => {
    const forceRefreshParam = forceRefresh ? "&forceRefresh=true" : "";
    let url = `/api/${provider}/logs?service=${serviceId}&range=${rangeSeconds}&region=${region}${forceRefreshParam}`;
    if (resourceId) {
      url += `&resource=${encodeURIComponent(resourceId)}`;
    }
    return authFetchJson<LogsResponse>(url, undefined, forceRefresh ? { headers: { "x-rabbittwatch-cache-bypass": "true" } } : undefined);
  },

  toggleAlarm: (provider: string, alarmName: string, region: string, enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    const url = `/api/${provider}/alarms/${encodeURIComponent(alarmName)}/toggle`;
    return authFetchJson<{ success: boolean; error?: string }>(url, undefined, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, enabled }),
    });
  },

  deleteAlarm: (provider: string, alarmName: string, region: string): Promise<{ success: boolean; error?: string }> => {
    const url = `/api/${provider}/alarms?region=${encodeURIComponent(region)}&alarmName=${encodeURIComponent(alarmName)}`;
    return authFetchJson<{ success: boolean; error?: string }>(url, undefined, {
      method: "DELETE",
    });
  },
};
