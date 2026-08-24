import { Request, Response } from "express";

import {
  getEvaluationDashboard,
  runDashboardEvaluation,
} from "./evaluation-dashboard.service";

export async function getEvaluations(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const dashboard = await getEvaluationDashboard({ userId, page, limit });

    return res.json({ success: true, ...dashboard });
  } catch (error: any) {
    console.error("getEvaluations error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function runEvaluation(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const { requestId, judgeProvider, judgeModel, judgeApiKey } = req.body;

    if (!requestId) {
      return res
        .status(400)
        .json({ success: false, error: "requestId is required" });
    }

    const evaluation = await runDashboardEvaluation({
      userId,
      requestId,
      judgeProvider,
      judgeModel,
      judgeApiKey,
    });
    return res.json({ success: true, evaluation });
  } catch (error: any) {
    console.error("runEvaluation error:", error);
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

function getErrorMessage(error: any): string {
  let errorMessage = error.message;
  if (error.response?.data) {
    const data = error.response.data;
    if (data?.error) {
      if (typeof data.error === "object") {
        errorMessage = data.error.message || JSON.stringify(data.error);
      } else {
        errorMessage = String(data.error);
      }
    } else if (typeof data === "string") {
      errorMessage = data;
    } else {
      errorMessage = JSON.stringify(data);
    }
  }
  return errorMessage;
}
