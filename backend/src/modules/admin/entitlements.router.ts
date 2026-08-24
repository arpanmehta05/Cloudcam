// ─── Entitlements Router ───
// Caller-facing (any authenticated user), NOT admin-only: lets the app read the
// current tenant's resolved entitlements to gate features in the UI.
import { Router, Request, Response } from "express";
import { ok, fail } from "../../shared/responses";
import { resolveEntitlementsForUser } from "./entitlements.service";

const router = Router();

router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    res.json(ok({ entitlements: await resolveEntitlementsForUser(userId) }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
});

export const entitlementsRouter = router;
