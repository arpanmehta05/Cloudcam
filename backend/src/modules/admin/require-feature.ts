import { Request, Response, NextFunction } from "express";
import { getFeatureAccessForUser } from "./entitlements.service";
import { logger } from "../../core/logger";
import { type FeatureKey } from "./feature-registry";

/**
 * Route guard: require the caller's tenant to be entitled to `featureKey`.
 *
 * Uses the caller's effective tenant plan. Unmanaged tenants resolve through
 * the default/free plan, so locked features stay locked even before an admin
 * assigns an explicit subscription.
 */
export function requireFeature(featureKey: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }
    try {
      const access = await getFeatureAccessForUser(userId, featureKey);
      if (access.allowed) {
        return next();
      }
      return res.status(403).json({
        success: false,
        code: "FEATURE_NOT_ENTITLED",
        error: access.lockedDescription || "Your current plan does not include this feature.",
        featureKey: access.featureKey,
        featureName: access.name,
        planKey: access.planKey,
        requiredPlanKey: access.requiredPlanKey,
        action: "upgrade_or_contact_support",
      });
    } catch (err) {
      // Fail open on resolver errors — never lock users out due to a bug here.
      logger.error(`requireFeature(${featureKey}) resolver error: ${err}`);
      return next();
    }
  };
}
