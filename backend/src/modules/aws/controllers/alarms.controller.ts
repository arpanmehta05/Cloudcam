import { logger } from "../../../core/logger";
/* eslint-disable import/no-restricted-paths */
import { Request, Response } from "express";
import {
  getCloudWatchAlarms,
  createAlarm,
  updateAlarm,
  toggleAlarmActions,
  deleteAlarm,
} from "../providers/alarms.provider";
import {
  provisionDefaultAlarms,
  previewDefaultAlarms,
} from "../services/alarm/default-alarms.service";
import {
  getAlarmServices,
  getAlarmResources,
  getSnsTopics,
} from "../services/alarm/alarm-metadata.service";
import { isNotConnectedError, notConnectedResponse } from "../../../middleware/error-handler";
import { getCached, setCached, invalidatePattern, CacheTTL } from "../../../middleware/response-cache";
import {
  loadUserCreds,
  isDefaultAlarmName,
  alarmErrorStatus,
  alarmErrorMessage,
} from "./helpers";

export async function alarmsGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const region = req.query.region as string | undefined;
    const forceRefresh =
      req.query.forceRefresh === "true" ||
      req.headers["x-rabbittwatch-cache-bypass"] === "true";
    if (forceRefresh) {
      invalidatePattern(userId, "/aws/alarms");
    }
    const cached = forceRefresh ? null : getCached(userId, req);
    if (cached) return res.json(cached.data);

    const data = await getCloudWatchAlarms(userId, region, roleArn, externalId);
    const response = {
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    };
    setCached(userId, req, response, CacheTTL.ALARMS);
    res.json(response);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarms] Error:", error.message);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch alarms",
      });
  }
}

export async function alarmsPost(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const { region, alarm } = req.body;
    if (!region || !alarm)
      return res.status(400).json({ error: "Missing region or alarm params" });
    if (!Array.isArray(alarm.actions) || alarm.actions.length === 0) {
      return res
        .status(400)
        .json({ error: "SNS Topic ARN is required for custom alarms" });
    }
    const result = await createAlarm(
      userId,
      region,
      alarm,
      roleArn,
      externalId,
    );
    invalidatePattern(userId, "/aws/alarms");
    res.json(result);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarms Create] Error:", error.message);
    res
      .status(alarmErrorStatus(error))
      .json({
        success: false,
        error: alarmErrorMessage(error, "Failed to create alarm"),
      });
  }
}

export async function alarmPut(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const rawName = req.params.name;
    const name = Array.isArray(rawName) ? rawName[0] : rawName;
    const { region, alarm } = req.body;
    if (!name) return res.status(400).json({ error: "Missing alarm name" });
    if (isDefaultAlarmName(name)) {
      return res.status(403).json({ error: "Default alarms cannot be edited" });
    }
    if (!region || !alarm)
      return res.status(400).json({ error: "Missing region or alarm params" });
    if (!Array.isArray(alarm.actions) || alarm.actions.length === 0) {
      return res
        .status(400)
        .json({ error: "SNS Topic ARN is required for custom alarms" });
    }
    const result = await updateAlarm(
      userId,
      region,
      name,
      alarm,
      roleArn,
      externalId,
    );
    invalidatePattern(userId, "/aws/alarms");
    res.json(result);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarms Update] Error:", error.message);
    res
      .status(alarmErrorStatus(error))
      .json({
        success: false,
        error: alarmErrorMessage(error, "Failed to update alarm"),
      });
  }
}

export async function alarmTogglePatch(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const rawName = req.params.name;
    const name = Array.isArray(rawName) ? rawName[0] : rawName;
    const { region, enabled } = req.body;
    if (!name) return res.status(400).json({ error: "Missing alarm name" });
    if (!region || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Missing region or enabled flag" });
    }
    const result = await toggleAlarmActions(
      userId,
      region,
      name,
      enabled,
      roleArn,
      externalId,
    );
    invalidatePattern(userId, "/aws/alarms");
    res.json(result);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarms Toggle] Error:", error.message);
    res
      .status(alarmErrorStatus(error))
      .json({
        success: false,
        error: alarmErrorMessage(error, "Failed to toggle alarm actions"),
      });
  }
}

export async function alarmDelete(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const { region } = req.query as any;
    const rawAlarmName = (req.query as any).alarmName;
    const alarmName = Array.isArray(rawAlarmName)
      ? rawAlarmName[0]
      : rawAlarmName;
    if (!region || !alarmName)
      return res.status(400).json({ error: "Missing region or alarmName" });
    const result = await deleteAlarm(
      userId,
      region,
      alarmName,
      roleArn,
      externalId,
    );
    invalidatePattern(userId, "/aws/alarms");
    res.json(result);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarms Delete] Error:", error.message);
    res
      .status(alarmErrorStatus(error))
      .json({
        success: false,
        error: alarmErrorMessage(error, "Failed to delete alarm"),
      });
  }
}

export async function defaultAlarmsPost(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const { alarmActions = [] } = req.body;
    if (!Array.isArray(alarmActions) || alarmActions.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "SNS Topic ARN is required for default alarms",
        });
    }
    logger.info(
      `[Defaults] Provisioning for user ${userId} with ${alarmActions.length} actions`,
    );
    const result = await provisionDefaultAlarms(
      userId,
      roleArn,
      externalId,
      alarmActions,
    );
    invalidatePattern(userId, "/aws/alarms");
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarms Provision] CRITICAL ERROR:", error);
    res
      .status(alarmErrorStatus(error))
      .json({
        success: false,
        error: alarmErrorMessage(error, "Failed to provision alarms"),
      });
  }
}

export async function defaultAlarmsGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    logger.info(`[Defaults] Preview requested for user ${userId}`);
    const result = await previewDefaultAlarms(userId, roleArn, externalId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error("[API Alarms Preview] CRITICAL ERROR:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to preview alarms",
      });
  }
}

export async function alarmMetadataServicesGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const region = (req.query.region as string) || "us-east-1";
    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);
    const services = await getAlarmServices(
      userId,
      region,
      roleArn,
      externalId,
    );
    const response = { success: true, services };
    setCached(userId, req, response, CacheTTL.RESOURCES);
    res.json(response);
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarm Services] Error:", error.message);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch alarm services",
      });
  }
}

export async function alarmMetadataResourcesGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const { service, region } = req.query as Record<string, string>;
    if (!service)
      return res
        .status(400)
        .json({ success: false, error: "Missing service parameter" });
    if (!region)
      return res
        .status(400)
        .json({ success: false, error: "Missing region parameter" });
    const result = await getAlarmResources(
      userId,
      service,
      region,
      roleArn,
      externalId,
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarm Resources] Error:", error.message);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch resources",
      });
  }
}

export async function alarmMetadataSnsGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const region = (req.query.region as string) || "us-east-1";
    const topics = await getSnsTopics(userId, region, roleArn, externalId);
    res.json({ success: true, topics });
  } catch (error: any) {
    if (isNotConnectedError(error)) return notConnectedResponse(res, error);
    logger.error("[API Alarm SNS] Error:", error.message);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch SNS topics",
      });
  }
}
