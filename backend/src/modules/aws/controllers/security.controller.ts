import { Request, Response } from "express";
import { getSecurityData } from "../services/security.service";
import { isNotConnectedError, notConnectedResponse } from "../../../middleware/error-handler";
import { getCached, setCached, CacheTTL } from "../../../middleware/response-cache";
import { loadUserCreds } from "./helpers";

export async function securityGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const region = req.query.region as string;
    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);
    const data = await getSecurityData(userId, region, roleArn, externalId);
    const response = {
      success: true,
      security: data,
      timestamp: new Date().toISOString(),
    };
    setCached(userId, req, response, CacheTTL.SECURITY);
    res.json(response);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    console.error("[API Security] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch security summary",
      });
  }
}
