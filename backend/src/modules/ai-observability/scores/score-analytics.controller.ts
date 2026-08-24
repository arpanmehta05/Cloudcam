import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import { reviewScopeFrom, sendReviewError } from "../shared/review-controller-utils";
import * as scoreAnalyticsService from "./score-analytics.service";

export async function scoreAnalyticsGet(req: Request, res: Response) {
  try {
    return res.json(ok(await scoreAnalyticsService.getScoreAnalytics(reviewScopeFrom(req))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function scoreComparisonGet(req: Request, res: Response) {
  try {
    return res.json(ok(await scoreAnalyticsService.getScoreComparison(reviewScopeFrom(req))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
