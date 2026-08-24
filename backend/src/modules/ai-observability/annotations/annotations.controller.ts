import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import {
  reviewActorId,
  reviewScopeFrom,
  sendReviewError,
} from "../shared/review-controller-utils";
import * as annotationService from "./annotations.service";

export async function annotationsPost(req: Request, res: Response) {
  try {
    const annotation = await annotationService.upsertAnnotation(
      reviewScopeFrom(req),
      {
        ...req.body,
        actorId: reviewActorId(req),
      },
    );
    return res.json(ok({ annotation }));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function annotationsGet(req: Request, res: Response) {
  try {
    const result = await annotationService.listAnnotations(
      reviewScopeFrom(req),
      req.query,
    );
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
