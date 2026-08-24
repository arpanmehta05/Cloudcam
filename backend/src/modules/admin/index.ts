// ─── Admin Module Public Interface ───
export { adminRouter } from "./admin.router";
// Caller-facing entitlements: read (router) and enforce (middleware) in product code.
export { entitlementsRouter } from "./entitlements.router";
export { requireFeature } from "./require-feature";
export {
  FEATURE_KEYS,
  FEATURE_DEFINITIONS,
  PLAN_RULES,
  requiredPlanForFeature,
} from "./feature-registry";
export type { FeatureKey, FeatureDefinition, PlanRuleDefinition } from "./feature-registry";
export {
  resolveEntitlements,
  resolveEntitlementsForUser,
  getFeatureAccessForUser,
} from "./entitlements.service";
export type { ResolvedEntitlements, FeatureAccess } from "./entitlements.service";
