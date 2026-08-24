import { Request, Response } from "express";
import { ActionRequest, SavingsRecord, AuditLog } from "../../../models/action.model";
import { loadUserCreds } from "./helpers";

const ACTION_HISTORY_TIME_RANGES: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function getProviderFromAction(action: any): "aws" | "azure" | "gcp" {
  const actionId = action.actionId || "";
  const service = action.service || "";
  const provider =
    action.metadata?.provider || action.postActionResult?.metadata?.provider;
  if (provider === "azure" || provider === "gcp" || provider === "aws") {
    return provider;
  }
  if (actionId.startsWith("azure-") || service.startsWith("azure")) {
    return "azure";
  }
  if (actionId.startsWith("gcp-") || service.startsWith("gcp")) {
    return "gcp";
  }
  return "aws";
}

// GET /api/actions/history — List action history for current user
export async function actionHistoryGet(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const limit = parseInt(String(req.query.limit || "50"), 10);
    const offset = parseInt(String(req.query.offset || "0"), 10);
    const status = req.query.status ? String(req.query.status) : undefined;
    const timeRange = req.query.timeRange
      ? String(req.query.timeRange)
      : undefined;
    const start = req.query.start
      ? new Date(String(req.query.start))
      : undefined;
    const end = req.query.end ? new Date(String(req.query.end)) : undefined;
    const provider = req.query.provider
      ? String(req.query.provider)
      : undefined;

    const filter: any = { userId };
    if (status) filter.status = status;
    if (
      timeRange &&
      timeRange !== "all" &&
      ACTION_HISTORY_TIME_RANGES[timeRange]
    ) {
      filter.createdAt = {
        $gte: new Date(Date.now() - ACTION_HISTORY_TIME_RANGES[timeRange]),
      };
    }
    if (start instanceof Date && !Number.isNaN(start.getTime())) {
      filter.createdAt = { ...(filter.createdAt || {}), $gte: start };
    }
    if (end instanceof Date && !Number.isNaN(end.getTime())) {
      filter.createdAt = { ...(filter.createdAt || {}), $lte: end };
    }

    if (provider === "azure") {
      filter.$or = [
        { actionId: { $regex: /^azure-/ } },
        { service: { $regex: /^azure/ } },
        { "metadata.provider": "azure" },
        { "postActionResult.metadata.provider": "azure" },
      ];
    } else if (provider === "gcp") {
      filter.$or = [
        { actionId: { $regex: /^gcp-/ } },
        { service: { $regex: /^gcp/ } },
        { "metadata.provider": "gcp" },
        { "postActionResult.metadata.provider": "gcp" },
      ];
    } else if (provider === "aws") {
      filter.$and = [
        { actionId: { $not: { $regex: /^(azure-|gcp-)/ } } },
        {
          $or: [
            { service: { $exists: false } },
            { service: { $not: { $regex: /^(azure|gcp)/ } } },
          ],
        },
        { "metadata.provider": { $nin: ["azure", "gcp"] } },
        { "postActionResult.metadata.provider": { $nin: ["azure", "gcp"] } },
      ];
    }

    const [actions, total] = await Promise.all([
      ActionRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      ActionRequest.countDocuments(filter),
    ]);

    const mappedActions = actions.map((action) => ({
      ...action,
      provider: getProviderFromAction(action),
    }));

    res.json({ success: true, actions: mappedActions, total, limit, offset });
  } catch (error: any) {
    console.error("Action history error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch history",
      });
  }
}

// GET /api/actions/status/:id — Get status of a specific action
export async function actionStatusGet(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { userId } = await loadUserCreds(req);
    const action = await ActionRequest.findOne({ _id: id, userId }).lean();
    if (!action)
      return res
        .status(404)
        .json({ success: false, error: "Action not found" });
    res.json({ success: true, action });
  } catch (error: any) {
    console.error("Action status error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch status",
      });
  }
}

// GET /api/actions/savings — Get savings summary for current user
export async function actionSavingsGet(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 1),
      250,
    );

    const [records, totals] = await Promise.all([
      SavingsRecord.find({ userId })
        .sort({ verifiedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      SavingsRecord.aggregate<{
        _id: null;
        totalEstimatedMonthlySavings: number;
        totalActualSavings: number;
        recordCount: number;
        verifiedCount: number;
        realizationRatioSum: number;
      }>([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalEstimatedMonthlySavings: { $sum: "$estimatedMonthlySavings" },
            totalActualSavings: {
              $sum: { $ifNull: ["$actualMonthlySavings", 0] },
            },
            recordCount: { $sum: 1 },
            verifiedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$actualMonthlySavings", null] },
                      { $gt: ["$estimatedMonthlySavings", 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            realizationRatioSum: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$actualMonthlySavings", null] },
                      { $gt: ["$estimatedMonthlySavings", 0] },
                    ],
                  },
                  {
                    $divide: [
                      "$actualMonthlySavings",
                      "$estimatedMonthlySavings",
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const total = totals[0] || {
      totalEstimatedMonthlySavings: 0,
      totalActualSavings: 0,
      recordCount: 0,
      verifiedCount: 0,
      realizationRatioSum: 0,
    };
    const avgRealizationRatio =
      total.verifiedCount > 0
        ? total.realizationRatioSum / total.verifiedCount
        : 0;

    const normalizedRecords = records.map((record) => ({
      ...record,
      actualSavings: record.actualMonthlySavings || 0,
      realizedAt: record.verifiedAt || record.createdAt,
    }));

    res.json({
      success: true,
      savings: {
        records: normalizedRecords,
        totalEstimatedMonthlySavings: total.totalEstimatedMonthlySavings,
        totalActualSavings: total.totalActualSavings,
        recordCount: total.recordCount,
        verifiedCount: total.verifiedCount,
        avgRealizationRatio: Number(avgRealizationRatio.toFixed(3)),
      },
    });
  } catch (error: any) {
    console.error("Action savings error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch savings",
      });
  }
}

// POST /api/actions/savings/verify — record realized monthly savings for feedback calibration
export async function actionSavingsVerifyPost(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const { actionRequestId, actualMonthlySavings, notes } = req.body || {};

    if (!actionRequestId || typeof actionRequestId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "actionRequestId is required" });
    }

    const actual = Number(actualMonthlySavings);
    if (!Number.isFinite(actual) || actual < 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "actualMonthlySavings must be a non-negative number",
        });
    }

    const actionReq = await ActionRequest.findOne({
      _id: actionRequestId,
      userId,
    }).lean();
    if (!actionReq) {
      return res
        .status(404)
        .json({ success: false, error: "Action request not found" });
    }

    const record = await SavingsRecord.findOneAndUpdate(
      { userId, actionRequestId },
      {
        $set: {
          actionId: actionReq.actionId,
          service: actionReq.service,
          estimatedMonthlySavings: actionReq.estimatedSavings || 0,
          actualMonthlySavings: actual,
          verifiedAt: new Date(),
          feedbackNotes: typeof notes === "string" ? notes : undefined,
        },
      },
      { upsert: true, returnDocument: "after" },
    ).lean();

    await AuditLog.create({
      event: "executed",
      userId,
      actionId: actionReq.actionId,
      requestId: String(actionReq._id),
      targets: (actionReq.targets || []).map((t: any) => t.resourceId),
      changes: [{ realizedSavingsFeedback: { actualMonthlySavings: actual } }],
      metadata: { type: "savings_feedback" },
    });

    res.json({ success: true, record });
  } catch (error: any) {
    console.error("Action savings verify error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to verify realized savings",
      });
  }
}

// GET /api/actions/audit — Get audit log
export async function actionAuditGet(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const limit = parseInt(String(req.query.limit || "100"), 10);
    const provider = req.query.provider
      ? String(req.query.provider)
      : undefined;

    const filter: any = { userId };
    if (provider === "azure") {
      filter.$or = [
        { actionId: { $regex: /^azure-/ } },
        { service: { $regex: /^azure/ } },
        { "metadata.provider": "azure" },
        { "postActionResult.metadata.provider": "azure" },
      ];
    } else if (provider === "gcp") {
      filter.$or = [
        { actionId: { $regex: /^gcp-/ } },
        { service: { $regex: /^gcp/ } },
        { "metadata.provider": "gcp" },
        { "postActionResult.metadata.provider": "gcp" },
      ];
    } else if (provider === "aws") {
      filter.$and = [
        { actionId: { $not: { $regex: /^(azure-|gcp-)/ } } },
        {
          $or: [
            { service: { $exists: false } },
            { service: { $not: { $regex: /^(azure|gcp)/ } } },
          ],
        },
        { "metadata.provider": { $nin: ["azure", "gcp"] } },
        { "postActionResult.metadata.provider": { $nin: ["azure", "gcp"] } },
      ];
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    const mappedLogs = logs.map((log) => ({
      ...log,
      provider: getProviderFromAction(log),
    }));
    res.json({ success: true, logs: mappedLogs });
  } catch (error: any) {
    console.error("Action audit error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch audit log",
      });
  }
}
