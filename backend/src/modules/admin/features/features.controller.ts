import { Request, Response } from "express";
import { ok, fail } from "../../../shared/responses";
import { listFeatures, createFeature, updateFeature } from "./features.service";
import { writeAudit } from "../audit.service";
import { paramString } from "../util";

function actor(req: Request) {
  const u = (req as any).user || {};
  return { userId: u.userId, email: u.email, ip: req.ip };
}

export async function listFeaturesHandler(_req: Request, res: Response) {
  try {
    res.json(ok({ features: await listFeatures() }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function createFeatureHandler(req: Request, res: Response) {
  try {
    const feature = await createFeature(req.body);
    await writeAudit(actor(req), {
      action: "feature.create",
      targetType: "feature",
      targetId: feature.key,
    });
    res.status(201).json(ok({ feature }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function updateFeatureHandler(req: Request, res: Response) {
  try {
    const feature = await updateFeature(paramString(req.params.key), req.body);
    await writeAudit(actor(req), {
      action: "feature.update",
      targetType: "feature",
      targetId: feature.key,
    });
    res.json(ok({ feature }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}
