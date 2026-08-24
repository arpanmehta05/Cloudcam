import { Request, Response } from "express";
import { getResources } from "../services/resources/resources.service";
import { isNotConnectedError, notConnectedResponse } from "../../../middleware/error-handler";
import { getCached, setCached, invalidatePattern, CacheTTL } from "../../../middleware/response-cache";
import { loadUserCreds } from "./helpers";

export async function resourcesGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const { region, forceRefresh } = req.query as any;

    if (forceRefresh === "true") {
      invalidatePattern(userId, "/aws/resources");
      res.setHeader("Cache-Control", "no-store");
    }

    const cached = forceRefresh === "true" ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);
    const data = await getResources(
      userId,
      region,
      roleArn,
      externalId,
      forceRefresh === "true",
    );
    const response = {
      success: true,
      inventory: data,
      timestamp: new Date().toISOString(),
    };
    if (forceRefresh !== "true") {
      setCached(userId, req, response, CacheTTL.RESOURCES);
    }
    res.json(response);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    console.error("[API Resources] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch resources",
      });
  }
}
