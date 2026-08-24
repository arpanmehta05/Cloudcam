import type { CloudProvider } from "@/lib/regions";
import type { CloudProviderConnectionSummary, NormalizedCloudResource } from "@/lib/cloud/provider-status";

export type ProviderFilter = CloudProvider | "all";

export interface Recommendation {
  id: string;
  provider: CloudProvider;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: string;
  savings?: string;
  action: string;
  resourceId?: string;
  source?: string;
  actionPlan?: {
    actionId: string;
    targets: { resourceId: string; resourceName: string; region: string }[];
    estimatedSavings: number;
    reasoning: string;
  };
}

export interface Diagnosis {
  provider: CloudProvider;
  title: string;
  status: "healthy" | "warning" | "critical";
  details: string;
}

export interface Optimization {
  id: string;
  provider: CloudProvider;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  savings?: string;
  action: string;
}

export interface Insights {
  recommendations: Recommendation[];
  diagnosis: Diagnosis[];
  optimizations: Optimization[];
  warnings: string[];
  providers: Record<CloudProvider, CloudProviderConnectionSummary>;
}

export interface ProviderBilling {
  provider: CloudProvider;
  currentSpend?: number;
  mtdSpend?: number;
  unit?: string;
  projectedTotal?: number | null;
}

export interface ProviderSecurity {
  provider: CloudProvider;
  status?: string;
  severity?: string | number;
  findingsCount?: number;
}

export interface Metrics {
  resources: NormalizedCloudResource[];
  billing: ProviderBilling[];
  security: ProviderSecurity[];
}

export interface CachedData {
  insights: Insights;
  metrics: Metrics;
  timestamp: string;
  dismissed: string[];
  version?: number;
}
