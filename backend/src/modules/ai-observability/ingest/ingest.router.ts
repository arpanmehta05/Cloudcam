import { Router } from "express";
import { aiIngestAuth, aiIngestAuthIfPresent } from "../../../middleware/ai-ingest-auth.middleware";
import { eventsBatchPost, eventsPost, requestTraceGet } from "./ingest.controller";
import { otelTracesPost } from "./otel.controller";
import { ingestScoresPost } from "../scores/ingest-scores.controller";
import { tracesBatchPost, tracesPost } from "../traces/traces.controller";

export const ingestPublicRouter = Router();

ingestPublicRouter.post("/events", aiIngestAuthIfPresent("events:write"), eventsPost);
ingestPublicRouter.post("/events/batch", aiIngestAuthIfPresent("events:write"), eventsBatchPost);
ingestPublicRouter.post("/traces", aiIngestAuth("traces:write"), tracesPost);
ingestPublicRouter.post("/traces/batch", aiIngestAuth("traces:write"), tracesBatchPost);
ingestPublicRouter.post("/otel/v1/traces", aiIngestAuth("traces:write"), otelTracesPost);
ingestPublicRouter.post("/scores", aiIngestAuth("traces:write"), ingestScoresPost);

export const ingestProtectedRouter = Router();

ingestProtectedRouter.get("/request/:id", requestTraceGet);
ingestProtectedRouter.post("/events", eventsPost);
ingestProtectedRouter.post("/events/batch", eventsBatchPost);
