import { Request, Response } from "express";
import { aiObservabilityOpenApiSpec } from "./ai-observability.openapi";

/** Serve the published OpenAPI 3.1 spec for the AI Observability API. */
export function openapiGet(_req: Request, res: Response) {
  res.setHeader("content-type", "application/json");
  return res.json(aiObservabilityOpenApiSpec);
}
