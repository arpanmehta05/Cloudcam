// Admin panel types — mirror the backend `modules/admin` contracts.

export interface PlanLimits {
  workspaces?: number | null;
  cloudConnections?: number | null;
  retentionDays?: number | null;
  seats?: number | null;
}

export type BillingPeriod = "monthly" | "yearly" | "custom";

export interface Plan {
  key: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod;
  features: Record<string, boolean>;
  limits: PlanLimits;
  isPublic: boolean;
  isActive: boolean;
}

export interface Feature {
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  onPlans: number;
  overrides: number;
}

export interface TenantSummary {
  id: string;
  name: string;
  email?: string | null;
  createdAt: string;
  seats: number;
  clouds: number;
  planKey: string | null;
  overrides: number;
}

export interface ResolvedEntitlements {
  tenantId: string;
  planKey: string | null;
  features: Record<string, boolean>;
  featureAccess?: Record<
    string,
    {
      name: string;
      description: string;
      lockedDescription: string;
      requiredPlanKey: string | null;
    }
  >;
  limits: PlanLimits;
  source: "subscription" | "default" | "none";
  managed?: boolean;
}

export interface TenantDetail {
  tenant: { id: string; name: string; email?: string | null; createdAt: string };
  subscription: {
    planKey: string;
    status: string;
    overrides: { features: Record<string, boolean>; limits: PlanLimits };
  } | null;
  entitlements: ResolvedEntitlements;
}

export interface Overview {
  tenantCount: number;
  activePlans: number;
  paidTenants: number;
  customDeals: number;
  mrr: number;
  currency: string;
}

export interface AuditEntry {
  _id: string;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
