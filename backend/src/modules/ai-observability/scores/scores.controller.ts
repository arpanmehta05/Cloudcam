import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import { reviewActorId, reviewScopeFrom, sendReviewError } from "../shared/review-controller-utils";
import * as scoreConfigService from "./scores.service";

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function scoreConfigsGet(req: Request, res: Response) {
  try {
    return res.json(ok(await scoreConfigService.listScoreConfigs(reviewScopeFrom(req))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function scoreConfigsPost(req: Request, res: Response) {
  try {
    const result = await scoreConfigService.createScoreConfig(reviewScopeFrom(req), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.status(201).json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function scoreConfigsPatch(req: Request, res: Response) {
  try {
    const result = await scoreConfigService.updateScoreConfig(reviewScopeFrom(req), param(req.params.id), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function scoreConfigsDelete(req: Request, res: Response) {
  try {
    return res.json(ok(await scoreConfigService.archiveScoreConfig(reviewScopeFrom(req), param(req.params.id))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
