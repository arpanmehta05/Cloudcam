import { Request, Response } from "express";
import { hasExplicitEnvironment, resolveAiScope } from "../../../services/ai-scope.service";
import * as traceIngestion from "../../../services/ai-trace-ingestion.service";
import * as traceQuery from "./traces.service";
import { sendReviewError } from "../shared/review-controller-utils";

interface AuthRequest extends Request { user?: { userId: string }; aiIngest?: { userId: string } }

function resolveIngestScope(req: Request) {
  const context = (req as AuthRequest).aiIngest;
  if (!context?.userId) throw Object.assign(new Error("Ingest authentication required"), { status: 401 });
  return {
    userId: context.userId as string,
    tenantId:
      typeof req.headers["x-tenant-id"] === "string"
        ? req.headers["x-tenant-id"]
        : undefined,
    workspaceId:
      typeof req.headers["x-workspace-id"] === "string"
        ? req.headers["x-workspace-id"]
        : undefined,
    environment:
      typeof req.headers["x-environment"] === "string"
        ? req.headers["x-environment"]
        : undefined,
  };
}

export async function tracesPost(req: Request, res: Response) {
  try {
    const result = await traceIngestion.ingestTrace(
      resolveIngestScope(req),
      req.body,
    );
    return res
      .status(201)
      .json({
        success: true,
        traceId: result.trace.traceId,
        spanCount: result.spanCount,
      });
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function tracesBatchPost(req: Request, res: Response) {
  try {
    const { traces } = req.body || {};
    if (!Array.isArray(traces) || traces.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "traces array is required" });
    }
    if (traces.length > 50) {
      return res
        .status(400)
        .json({ success: false, error: "Maximum 50 traces per batch" });
    }

    const result = await traceIngestion.ingestTraceBatch(resolveIngestScope(req), traces);
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function tracesGet(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user?.userId;
    if (!userId) throw Object.assign(new Error("Authentication required"), { status: 401 });
    const scope = await resolveAiScope(req, userId);
    if (!hasExplicitEnvironment(req)) {
      scope.environment = undefined;
    }
    const result = await traceQuery.listTraces(
      scope,
      req.query as Record<string, unknown>,
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendReviewError(res, error);
  }
}

