import type { BillingPeriod, IPlanLimits } from "../../../models/plan.model";

export interface PlanInput {
  key?: string;
  name?: string;
  description?: string | null;
  price?: number;
  currency?: string;
  billingPeriod?: BillingPeriod;
  features?: Record<string, boolean>;
  limits?: IPlanLimits;
  isPublic?: boolean;
  isActive?: boolean;
}
