import { Request, Response } from "express";
import { getServiceMetrics } from "../services/metrics";
import { isNotConnectedError, notConnectedResponse } from "../../../middleware/error-handler";
import { getCached, setCached, invalidatePattern, CacheTTL } from "../../../middleware/response-cache";
import { loadUserCreds } from "./helpers";

export async function metricsGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const {
      service: serviceKey,
      range,
      region,
      forceRefresh,
    } = req.query as any;
    if (!serviceKey)
      return res.status(400).json({ error: "Invalid or missing service key" });

    if (forceRefresh === "true") {
      invalidatePattern(userId, "/aws/metrics");
    }

    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);
    const data = await getServiceMetrics(
      userId,
      serviceKey,
      range || "24h",
      region,
      roleArn,
      externalId,
    );
    const response = {
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    };
    setCached(userId, req, response, CacheTTL.METRICS);
    res.json(response);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    console.error("[API Metrics] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch metrics",
      });
  }
}
