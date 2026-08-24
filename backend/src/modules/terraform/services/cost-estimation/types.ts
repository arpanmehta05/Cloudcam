import { ServiceId } from "@rabbittwatch/types";

export interface CostNodeInput {
  id: string;
  serviceId: ServiceId;
  config: Record<string, unknown>;
}

export interface CostEdgeInput {
  source: string;
  target: string;
}

export interface CostEstimationRequest {
  nodes: CostNodeInput[];
  edges: CostEdgeInput[];
  region: string;
  sessionId: string;
}

export interface CostBreakdown {
  service: string;
  serviceName: string;
  monthlyCost: number;
  components: Array<{
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    monthlyCost: number;
  }>;
  supported: boolean;
}

export interface CostWarning {
  code: string;
  message: string;
  node: string;
  severity: "info" | "warning" | "error";
}

export interface CostEstimationResult {
  totalMonthlyCost: number;
  currency: string;
  engine: "infracost" | "price-list" | "fallback";
  breakdown: CostBreakdown[];
  warnings: CostWarning[];
  cached: boolean;
  estimatedAt: string;
}
