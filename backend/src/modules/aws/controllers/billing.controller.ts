import { Request, Response } from "express";
import { getBillingData } from "../services/billing/billing.service";
import { isNotConnectedError, notConnectedResponse } from "../../../middleware/error-handler";
import { getCached, setCached, CacheTTL } from "../../../middleware/response-cache";
import { loadUserCreds } from "./helpers";

export async function billingGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const { range } = req.query as any;
    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);
    const data = await getBillingData(userId, range, roleArn, externalId);
    const response = {
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    };
    setCached(userId, req, response, CacheTTL.BILLING);
    res.json(response);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    console.error("[API Billing] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch billing data",
      });
  }
}
