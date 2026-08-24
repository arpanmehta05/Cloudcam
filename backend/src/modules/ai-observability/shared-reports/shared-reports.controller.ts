import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import { reviewActorId, reviewScopeFrom, sendReviewError } from "../shared/review-controller-utils";
import * as reportsService from "../services/shared-reports.service";

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function sharedReportsGet(req: Request, res: Response) {
  try {
    return res.json(ok(await reportsService.listSharedReports(reviewScopeFrom(req))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function sharedReportsPost(req: Request, res: Response) {
  try {
    const result = await reportsService.createSharedReport(reviewScopeFrom(req), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.status(201).json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function sharedReportRevoke(req: Request, res: Response) {
  try {
    const result = await reportsService.revokeSharedReport(
      reviewScopeFrom(req),
      param(req.params.id),
      reviewActorId(req),
    );
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

/** Public, unauthenticated endpoint — resolves a share token to its snapshot. */
export async function sharedReportPublicGet(req: Request, res: Response) {
  try {
    return res.json(ok(await reportsService.getPublicReport(param(req.params.token))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
