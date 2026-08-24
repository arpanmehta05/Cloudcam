import { Request, Response } from "express";
import { ok, fail } from "../../../shared/responses";
import {
  listTenants,
  getTenantDetail,
  assignPlan,
  setOverrides,
} from "./tenants.service";
import { writeAudit } from "../audit.service";
import { paramString } from "../util";

function actor(req: Request) {
  const u = (req as any).user || {};
  return { userId: u.userId, email: u.email, ip: req.ip };
}

export async function listTenantsHandler(_req: Request, res: Response) {
  try {
    res.json(ok({ tenants: await listTenants() }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function getTenantHandler(req: Request, res: Response) {
  try {
    res.json(ok(await getTenantDetail(paramString(req.params.id))));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function assignPlanHandler(req: Request, res: Response) {
  try {
    const tenantId = paramString(req.params.id);
    const subscription = await assignPlan(tenantId, req.body?.planKey);
    await writeAudit(actor(req), {
      action: "tenant.plan.assign",
      targetType: "tenant",
      targetId: tenantId,
      metadata: { planKey: subscription.planKey },
    });
    res.json(ok({ subscription }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function setOverridesHandler(req: Request, res: Response) {
  try {
    const tenantId = paramString(req.params.id);
    const subscription = await setOverrides(tenantId, req.body || {});
    await writeAudit(actor(req), {
      action: "tenant.override.set",
      targetType: "tenant",
      targetId: tenantId,
      metadata: { features: req.body?.features, limits: req.body?.limits },
    });
    res.json(ok({ subscription }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}
