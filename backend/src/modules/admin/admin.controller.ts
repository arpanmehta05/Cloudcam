import { Request, Response } from "express";
import { ok, fail } from "../../shared/responses";
import { getOverview } from "./admin.service";
import { listAudit } from "./audit.service";

export async function overviewHandler(_req: Request, res: Response) {
  try {
    res.json(ok({ overview: await getOverview() }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}

export async function listAuditHandler(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(ok({ entries: await listAudit(limit) }));
  } catch (err: any) {
    res.status(err.status || 500).json(fail(err));
  }
}
