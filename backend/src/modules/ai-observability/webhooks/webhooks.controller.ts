import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import { reviewActorId, reviewScopeFrom, sendReviewError } from "../shared/review-controller-utils";
import * as webhooksService from "../services/webhooks.service";

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function webhooksGet(req: Request, res: Response) {
  try {
    return res.json(ok(await webhooksService.listWebhooks(reviewScopeFrom(req))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function webhooksPost(req: Request, res: Response) {
  try {
    const result = await webhooksService.createWebhook(reviewScopeFrom(req), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.status(201).json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function webhookPatch(req: Request, res: Response) {
  try {
    const result = await webhooksService.updateWebhook(reviewScopeFrom(req), param(req.params.id), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function webhookRotate(req: Request, res: Response) {
  try {
    const result = await webhooksService.rotateWebhookSecret(
      reviewScopeFrom(req),
      param(req.params.id),
      reviewActorId(req),
    );
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function webhookDelete(req: Request, res: Response) {
  try {
    const result = await webhooksService.deleteWebhook(
      reviewScopeFrom(req),
      param(req.params.id),
      reviewActorId(req),
    );
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function webhookTest(req: Request, res: Response) {
  try {
    return res.json(ok(await webhooksService.sendTestEvent(reviewScopeFrom(req), param(req.params.id))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function webhookDeliveriesGet(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit);
    return res.json(
      ok(
        await webhooksService.listDeliveries(
          reviewScopeFrom(req),
          param(req.params.id),
          Number.isFinite(limit) ? limit : undefined,
        ),
      ),
    );
  } catch (error) {
    return sendReviewError(res, error);
  }
}
