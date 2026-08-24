import { Request, Response } from "express";
import { AppError } from "../../../core/errors";
import * as traceIngestion from "../../../services/ai-trace-ingestion.service";
import { mapOtelToTraceEnvelopes } from "../services/ingestion/otel-mapper";
import { sendReviewError } from "../shared/review-controller-utils";

interface IngestRequest extends Request {
  aiIngest?: { userId: string };
}

function resolveIngestScope(req: Request): traceIngestion.TraceScope {
  const context = (req as IngestRequest).aiIngest;
  if (!context?.userId) {
    throw new AppError({
      code: "ERR_UNAUTHORIZED",
      message: "Ingest authentication required",
      status: 401,
    });
  }

  return {
    userId: context.userId,
    tenantId: typeof req.headers["x-tenant-id"] === "string" ? req.headers["x-tenant-id"] : undefined,
    workspaceId: typeof req.headers["x-workspace-id"] === "string" ? req.headers["x-workspace-id"] : undefined,
    environment: typeof req.headers["x-environment"] === "string" ? req.headers["x-environment"] : undefined,
  };
}

export async function otelTracesPost(req: Request, res: Response) {
  try {
    const envelopes = mapOtelToTraceEnvelopes(req.body || {});
    if (envelopes.length === 0) {
      throw new AppError({
        code: "ERR_BAD_REQUEST",
        message: "No OTLP spans with traceId and spanId were found",
        status: 400,
      });
    }
    if (envelopes.length > 50) {
      throw new AppError({
        code: "ERR_BAD_REQUEST",
        message: "Maximum 50 OTLP traces per batch",
        status: 400,
      });
    }

    const result = await traceIngestion.ingestTraceBatch(resolveIngestScope(req), envelopes);
    return res.status(201).json({ success: true, traceCount: envelopes.length, ...result });
  } catch (error) {
    return sendReviewError(res, error);
  }
}
