import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import { reviewScopeFrom, sendReviewError } from "../shared/review-controller-utils";
import * as customPricingService from "./pricing.service";

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function customPricesGet(req: Request, res: Response) {
  try {
    return res.json(ok(await customPricingService.listCustomPrices(reviewScopeFrom(req))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function customPricesUnpricedGet(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit || 20);
    return res.json(ok(await customPricingService.listUnpricedModels(reviewScopeFrom(req), limit)));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function customPricesPost(req: Request, res: Response) {
  try {
    return res.status(201).json(ok(await customPricingService.createCustomPrice(reviewScopeFrom(req), req.body)));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function customPricesPatch(req: Request, res: Response) {
  try {
    return res.json(ok(await customPricingService.updateCustomPrice(reviewScopeFrom(req), param(req.params.id), req.body)));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function customPricesDelete(req: Request, res: Response) {
  try {
    return res.json(ok(await customPricingService.deleteCustomPrice(reviewScopeFrom(req), param(req.params.id))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
