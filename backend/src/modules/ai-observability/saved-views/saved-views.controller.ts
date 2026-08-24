import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import { reviewActorId, reviewScopeFrom, sendReviewError } from "../shared/review-controller-utils";
import * as savedViewsService from "../services/saved-views.service";

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function savedViewsGet(req: Request, res: Response) {
  try {
    return res.json(ok(await savedViewsService.listSavedViews(reviewScopeFrom(req), req.query.viewType)));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function savedViewsPost(req: Request, res: Response) {
  try {
    const result = await savedViewsService.createSavedView(reviewScopeFrom(req), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.status(201).json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function savedViewsPatch(req: Request, res: Response) {
  try {
    const result = await savedViewsService.updateSavedView(reviewScopeFrom(req), param(req.params.id), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function savedViewsDelete(req: Request, res: Response) {
  try {
    return res.json(ok(await savedViewsService.deleteSavedView(reviewScopeFrom(req), param(req.params.id))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
