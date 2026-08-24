import { Request, Response } from "express";
import { ok, fail } from "../../../shared/responses";
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
} from "./plans.service";
import { writeAudit } from "../audit.service";
import { paramString } from "../util";

function actor(req: Request) {
  const u = (req as any).user || {};
  return { userId: u.userId, email: u.email, ip: req.ip };
}

export async function listPlansHandler(_req: Request, res: Response) {
  try {
    res.json(ok({ plans: await listPlans() }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function getPlanHandler(req: Request, res: Response) {
  try {
    res.json(ok({ plan: await getPlan(paramString(req.params.key)) }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function createPlanHandler(req: Request, res: Response) {
  try {
    const plan = await createPlan(req.body);
    await writeAudit(actor(req), {
      action: "plan.create",
      targetType: "plan",
      targetId: plan.key,
      metadata: { name: plan.name, price: plan.price },
    });
    res.status(201).json(ok({ plan }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function updatePlanHandler(req: Request, res: Response) {
  try {
    const plan = await updatePlan(paramString(req.params.key), req.body);
    await writeAudit(actor(req), {
      action: "plan.update",
      targetType: "plan",
      targetId: plan.key,
    });
    res.json(ok({ plan }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function deletePlanHandler(req: Request, res: Response) {
  try {
    const result = await deletePlan(paramString(req.params.key));
    await writeAudit(actor(req), {
      action: "plan.delete",
      targetType: "plan",
      targetId: result.key,
    });
    res.json(ok(result));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}
