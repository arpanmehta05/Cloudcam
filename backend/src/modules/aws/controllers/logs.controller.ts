import { Request, Response } from "express";
import { queryLogs, getServiceLogs } from "../services/logs/logs.service";
import { loadUserCreds } from "./helpers";

export async function logsGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const {
      service: serviceKey,
      logGroups: logGroupsStr,
      query: queryStr,
      range: rangeStr,
      region,
      resource: resourceId,
    } = req.query as any;
    const range = parseInt(rangeStr || "3600");

    // Route 1: Auto-resolve log groups from service key
    if (serviceKey) {
      const result = await getServiceLogs(
        userId,
        serviceKey,
        range,
        region,
        roleArn,
        externalId,
        resourceId,
      );
      return res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    }

    // Route 2: Manual log groups (existing behavior)
    if (!logGroupsStr)
      return res
        .status(400)
        .json({ error: "Missing service or logGroups parameter" });
    const logGroups = logGroupsStr.split(",");
    const query =
      queryStr ||
      "fields @timestamp, @message | sort @timestamp desc | limit 20";
    const results = await queryLogs(
      userId,
      query,
      logGroups,
      range,
      region,
      roleArn,
      externalId,
    );
    res.json({
      success: true,
      logs: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API Logs] Error:", error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Failed to query logs" });
  }
}
