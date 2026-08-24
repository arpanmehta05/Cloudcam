import { Request, Response, NextFunction } from "express";
import { verifyIngestTokenDetailed } from "../services/ai-ingest-key.service";
import { FEATURE_KEYS, getFeatureAccessForUser } from "../modules/admin";

export interface AiIngestAuthContext {
  userId: string;
  keyId: string;
  scopes: string[];
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();

  const header = req.headers["x-rabbittize-ingest-key"];
  if (Array.isArray(header)) return header[0] || null;
  if (typeof header === "string") return header.trim();

  return null;
}

async function enforceAiObservabilityIngestAccess(
  context: AiIngestAuthContext,
  res: Response,
): Promise<boolean> {
  const access = await getFeatureAccessForUser(
    context.userId,
    FEATURE_KEYS.aiObservability,
  );
  if (access.allowed) return true;

  res.status(403).json({
    success: false,
    code: "FEATURE_NOT_ENTITLED",
    error:
      access.lockedDescription ||
      "Your current plan does not include AI Observability ingestion.",
    featureKey: access.featureKey,
    featureName: access.name,
    planKey: access.planKey,
    requiredPlanKey: access.requiredPlanKey,
    action: "upgrade_or_contact_support",
  });
  return false;
}

export function aiIngestAuth(
  requiredScope: string,
  options: { requireAiObservability?: boolean } = {},
) {
  const requireAiObservability = options.requireAiObservability ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res
          .status(401)
          .json({ success: false, code: "token_invalid", error: "Ingest key required" });
      }

      const result = await verifyIngestTokenDetailed(token, requiredScope);
      if (!result.valid) {
        return res
          .status(401)
          .json({ success: false, code: result.code, error: "Invalid or revoked ingest key" });
      }
      const context = result.context;

      if (
        requireAiObservability &&
        !(await enforceAiObservabilityIngestAccess(context, res))
      ) {
        return;
      }

      (req as any).aiIngest = context;
      return next();
    } catch (error) {
      console.error("ai-ingest-auth error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to authenticate ingest key" });
    }
  };
}

export function aiIngestAuthIfPresent(requiredScope: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token || !token.startsWith("rw_live_")) return next("route");

    try {
      const result = await verifyIngestTokenDetailed(token, requiredScope);
      if (!result.valid) {
        return res
          .status(401)
          .json({ success: false, code: result.code, error: "Invalid or revoked ingest key" });
      }
      const context = result.context;

      if (!(await enforceAiObservabilityIngestAccess(context, res))) return;

      (req as any).aiIngest = context;
      return next();
    } catch (error) {
      console.error("ai-ingest-auth optional error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to authenticate ingest key" });
    }
  };
}
