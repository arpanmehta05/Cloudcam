// ─── Admin Module Public Interface ───
// Product code gates features through these; admin pages are imported directly
// by their thin app/admin route files.
export {
  useEntitlements,
  fetchMyEntitlements,
  FeatureGate,
  FeatureLockedGate,
  FeatureLockModal,
  LockedFeatureScreen,
} from "./entitlements.client";
export type { MyEntitlements, EntitlementsState } from "./entitlements.client";
