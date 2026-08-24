import { Request, Response } from "express";
import * as ingestionService from "../services/ingestion/provider-ingestion.service";
import * as overviewService from "../services/overview.service";
import * as onboardingService from "../../../services/ai-onboarding.service";
import { hasExplicitEnvironment, resolveAiScope } from "../services/scope.service";

// GET /api/ai-observability/request/:id
export async function requestTraceGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    // Match the list endpoints: without an explicit environment, look across all
    // environments so a request logged under a non-"prod" env is still found.
    if (!hasExplicitEnvironment(req)) scope.environment = undefined;
    const requestId = req.params.id as string;

    const trace = await overviewService.getRequestTrace(scope, requestId);
    if (!trace) {
      return res
        .status(404)
        .json({ success: false, error: "Request trace not found" });
    }

    return res.json({ success: true, trace });
  } catch (error) {
    console.error("ai-observability requestTraceGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch request trace" });
  }
}

// POST /api/ai-observability/events
export async function eventsPost(req: Request, res: Response) {
  try {
    const ingestContext = (req as any).aiIngest;
    const userId =
      ingestContext?.userId || ((req as any).user.userId as string);
    const scope = ingestContext
      ? {
          userId,
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
              : "prod",
        }
      : await resolveAiScope(req, userId);
    const {
      provider,
      model,
      requestId,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      cost,
      status,
      errorMessage,
      metadata,
      serviceName,
      endpoint,
      traceId,
      spanId,
      parentSpanId,
      operationName,
      inputPreview,
      outputPreview,
      promptHash,
      promptTemplateId,
      promptVersionId,
      promptName,
      promptSlug,
      promptVersion,
      promptLabel,
      promptEnvironment,
      promptState,
      promptContentHash,
      tags,
    } = req.body || {};

    if (!provider || !model) {
      return res
        .status(400)
        .json({ success: false, error: "provider and model are required" });
    }

    const validProviders = [
      "openai",
      "gemini",
      "anthropic",
      "bedrock",
      "nvidia",
      "custom",
    ];
    if (!validProviders.includes(provider)) {
      return res
        .status(400)
        .json({
          success: false,
          error: `provider must be one of: ${validProviders.join(", ")}`,
        });
    }

    if (!ingestContext) {
      const profile = await onboardingService.getOnboardingProfile(
        scope.userId,
      );
      const validation = onboardingService.validateEventContract(
        {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          environment: scope.environment,
          serviceName,
          endpoint,
          requestId,
        },
        profile.requiredEventFields || undefined,
      );
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: `Missing required instrumentation fields: ${validation.missing.join(", ")}`,
        });
      }
    }

    const entry = await ingestionService.record({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      environment: scope.environment,
      serviceName,
      endpoint,
      provider,
      model,
      requestId,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      cost,
      status,
      errorMessage,
      traceId,
      spanId,
      parentSpanId,
      operationName,
      inputPreview,
      outputPreview,
      promptHash,
      promptTemplateId,
      promptVersionId,
      promptName,
      promptSlug,
      promptVersion,
      promptLabel,
      promptEnvironment,
      promptState,
      promptContentHash,
      tags,
      metadata,
    });

    return res.status(201).json({ success: true, requestId: entry.requestId });
  } catch (error: any) {
    console.error("ai-observability eventsPost error:", error);
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ success: false, error: "Duplicate requestId" });
    }
    return res
      .status(500)
      .json({ success: false, error: "Failed to record event" });
  }
}

// POST /api/ai-observability/events/batch
export async function eventsBatchPost(req: Request, res: Response) {
  try {
    const ingestContext = (req as any).aiIngest;
    const userId =
      ingestContext?.userId || ((req as any).user.userId as string);
    const scope = ingestContext
      ? {
          userId,
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
              : "prod",
        }
      : await resolveAiScope(req, userId);
    const { events } = req.body || {};

    if (!Array.isArray(events) || events.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "events array is required" });
    }

    if (events.length > 100) {
      return res
        .status(400)
        .json({ success: false, error: "Maximum 100 events per batch" });
    }

    if (!ingestContext) {
      const profile = await onboardingService.getOnboardingProfile(
        scope.userId,
      );
      for (const event of events) {
        const validation = onboardingService.validateEventContract(
          {
            tenantId: scope.tenantId || event.tenantId,
            workspaceId: scope.workspaceId || event.workspaceId,
            environment: scope.environment || event.environment,
            serviceName: event.serviceName,
            endpoint: event.endpoint,
            requestId: event.requestId,
          },
          profile.requiredEventFields || undefined,
        );
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: `Batch event missing required fields: ${validation.missing.join(", ")}`,
          });
        }
      }
    }

    // Inject userId into each event
    const withUser = events.map((e: any) => ({
      ...e,
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      environment: scope.environment,
    }));
    const result = await ingestionService.ingest(withUser);

    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error("ai-observability eventsBatchPost error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to ingest batch" });
  }
}
