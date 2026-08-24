import { Plan, IPlanLimits } from "../../models/plan.model";
import { Subscription } from "../../models/subscription.model";
import { Feature } from "../../models/feature.model";
import { User } from "../../models/user.model";
import { mapToRecord } from "./util";
import {
  featureDefinitionFor,
  requiredPlanForFeature,
  type FeatureKey,
} from "./feature-registry";

export interface ResolvedEntitlements {
  tenantId: string;
  planKey: string | null;
  features: Record<string, boolean>;
  featureAccess: Record<
    string,
    {
      name: string;
      description: string;
      lockedDescription: string;
      requiredPlanKey: string | null;
    }
  >;
  limits: IPlanLimits;
  source: "subscription" | "default" | "none";
  // True only when an admin has explicitly placed this tenant on a plan.
  // Unmanaged tenants still resolve through the default/free plan and are
  // enforced from that effective plan.
  managed: boolean;
}

export interface FeatureAccess {
  featureKey: string;
  allowed: boolean;
  managed: boolean;
  planKey: string | null;
  requiredPlanKey: string | null;
  name: string | null;
  lockedDescription: string | null;
}

const EMPTY_LIMITS: IPlanLimits = {
  workspaces: null,
  cloudConnections: null,
  retentionDays: null,
  seats: null,
};

/** Merge limit overrides on top of a base; a null/undefined override inherits. */
function mergeLimits(base: IPlanLimits, override?: IPlanLimits): IPlanLimits {
  const out: IPlanLimits = { ...EMPTY_LIMITS, ...base };
  if (override) {
    for (const k of Object.keys(EMPTY_LIMITS) as (keyof IPlanLimits)[]) {
      if (override[k] !== null && override[k] !== undefined) out[k] = override[k];
    }
  }
  return out;
}

/**
 * The single source of truth for what a tenant is entitled to:
 * plan defaults ⊕ per-tenant overrides, with every active registry feature
 * resolved to an explicit boolean. Product code calls this to gate features.
 */
export async function resolveEntitlements(
  tenantId: string,
): Promise<ResolvedEntitlements> {
  const [subscription, activeFeatures] = await Promise.all([
    Subscription.findOne({ tenantId }),
    Feature.find({ isActive: true }).select("key").lean(),
  ]);

  // Determine the effective plan: the tenant's subscription plan, else the
  // implicit "free" default if one exists.
  let plan = subscription
    ? await Plan.findOne({ key: subscription.planKey })
    : null;
  let source: ResolvedEntitlements["source"] = subscription ? "subscription" : "none";
  if (!plan) {
    plan = await Plan.findOne({ key: "free", isActive: true });
    if (plan) source = subscription ? "subscription" : "default";
  }

  const planFeatures = mapToRecord(plan?.features);
  const overrideFeatures = mapToRecord(subscription?.overrides?.features);

  // Every registered feature resolves to an explicit boolean: plan default
  // (false if unset) then per-tenant override on top.
  const features: Record<string, boolean> = {};
  const featureAccess: ResolvedEntitlements["featureAccess"] = {};
  for (const f of activeFeatures) {
    features[f.key] = planFeatures[f.key] ?? false;
    const definition = featureDefinitionFor(f.key);
    if (definition) {
      featureAccess[f.key] = {
        name: definition.name,
        description: definition.description,
        lockedDescription: definition.lockedDescription,
        requiredPlanKey: requiredPlanForFeature(f.key),
      };
    }
  }
  // Include any plan/override keys not (yet) in the active registry, so nothing
  // silently disappears if a feature is deactivated.
  for (const key of Object.keys(planFeatures)) {
    if (!(key in features)) features[key] = planFeatures[key];
  }
  for (const key of Object.keys(overrideFeatures)) {
    features[key] = overrideFeatures[key];
  }

  const limits = mergeLimits(
    plan?.limits ?? EMPTY_LIMITS,
    subscription?.overrides?.limits,
  );

  return {
    tenantId,
    planKey: plan?.key ?? null,
    features,
    featureAccess,
    limits,
    source,
    managed: !!subscription,
  };
}

/** Resolve entitlements for a user by deriving their canonical tenant id. */
export async function resolveEntitlementsForUser(
  userId: string,
): Promise<ResolvedEntitlements> {
  const user = await User.findById(userId).select("tenantId");
  const tenantId = user?.tenantId || userId;
  return resolveEntitlements(tenantId);
}

export async function getFeatureAccessForUser(
  userId: string,
  featureKey: FeatureKey | string,
): Promise<FeatureAccess> {
  const entitlements = await resolveEntitlementsForUser(userId);
  const definition = featureDefinitionFor(featureKey);
  const allowed = entitlements.features[featureKey] === true;

  return {
    featureKey,
    allowed,
    managed: entitlements.managed,
    planKey: entitlements.planKey,
    requiredPlanKey: requiredPlanForFeature(featureKey),
    name: definition?.name ?? null,
    lockedDescription: definition?.lockedDescription ?? null,
  };
}
