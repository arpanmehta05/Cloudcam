/**
 * OpenAPI 3.1 specification for the RabbittWatch AI Observability API.
 *
 * Served at `GET /api/ai-observability/openapi.json`. Kept as a typed module so
 * it is bundled with the build and cannot drift out of the deployed artifact.
 * This is the published contract for ingestion, tracing, evaluations, cost,
 * scores, webhooks, comments, and shareable reports.
 */

const jsonResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { type: "object" },
    },
  },
});

const okEnvelope = {
  type: "object",
  properties: {
    success: { type: "boolean" },
  },
  additionalProperties: true,
};

export const aiObservabilityOpenApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "RabbittWatch AI Observability API",
    version: "1.0.0",
    description:
      "Enterprise AI observability platform: trace ingestion, evaluations, cost controls, scores, and enterprise controls.",
  },
  servers: [{ url: "/api", description: "Application API root" }],
  tags: [
    { name: "Ingestion", description: "Public write API (ingest-key auth)" },
    { name: "Traces", description: "Trace and observation query" },
    { name: "Evaluations", description: "Evaluation dashboard and scoring workflows" },
    { name: "Cost", description: "Cost attribution and evaluation cost" },
    { name: "Scores", description: "Score ingestion" },
    { name: "Administration", description: "Keys, webhooks, reports" },
    { name: "Collaboration", description: "Comments, mentions, assignments" },
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: "apiKey",
        in: "cookie",
        name: "session",
        description: "Authenticated dashboard session.",
      },
      ingestKey: {
        type: "apiKey",
        in: "header",
        name: "X-Rabbittize-Ingest-Key",
        description: "Scoped ingest key for the public write API.",
      },
    },
    schemas: {
      OkEnvelope: okEnvelope,
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [false] },
          error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } },
        },
      },
      TraceIngest: {
        type: "object",
        required: ["traceId"],
        properties: {
          traceId: { type: "string" },
          name: { type: "string" },
          sessionId: { type: "string" },
          userId: { type: "string" },
          environment: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          spans: { type: "array", items: { type: "object" } },
        },
      },
      ScoreInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          traceId: { type: "string" },
          observationId: { type: "string" },
          value: { oneOf: [{ type: "number" }, { type: "boolean" }, { type: "string" }] },
          dataType: { type: "string", enum: ["numeric", "boolean", "categorical", "text"] },
          comment: { type: "string" },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          enabled: { type: "boolean" },
        },
      },
    },
  },
  security: [{ sessionAuth: [] }],
  paths: {
    "/ai-observability/traces": {
      post: {
        tags: ["Ingestion"],
        summary: "Ingest a trace (single)",
        security: [{ ingestKey: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TraceIngest" } } },
        },
        responses: { "200": jsonResponse("Trace accepted"), "401": jsonResponse("Missing/invalid ingest key") },
      },
      get: {
        tags: ["Traces"],
        summary: "List traces",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "environment", in: "query", schema: { type: "string" } },
          { name: "model", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": jsonResponse("Trace list") },
      },
    },
    "/ai-observability/traces/batch": {
      post: {
        tags: ["Ingestion"],
        summary: "Ingest traces (batch)",
        security: [{ ingestKey: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": jsonResponse("Batch accepted") },
      },
    },
    "/ai-observability/otel/v1/traces": {
      post: {
        tags: ["Ingestion"],
        summary: "OTLP/JSON trace ingestion bridge",
        security: [{ ingestKey: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": jsonResponse("OTLP accepted") },
      },
    },
    "/ai-observability/scores": {
      post: {
        tags: ["Scores"],
        summary: "Ingest one or many scores",
        security: [{ ingestKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/ScoreInput" },
                  { type: "object", properties: { scores: { type: "array", items: { $ref: "#/components/schemas/ScoreInput" } } } },
                ],
              },
            },
          },
        },
        responses: { "200": jsonResponse("Scores recorded") },
      },
    },
    "/ai-observability/observations": {
      get: {
        tags: ["Traces"],
        summary: "Query span-level observations with field projection",
        responses: { "200": jsonResponse("Observation list") },
      },
    },
    "/ai-observability/traces/{traceId}": {
      get: {
        tags: ["Traces"],
        summary: "Trace detail with spans, requests, scores, cost",
        parameters: [{ name: "traceId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": jsonResponse("Trace detail") },
      },
    },
    "/ai-observability/costs/attribution": {
      get: {
        tags: ["Cost"],
        summary: "Cost attribution by dimension",
        parameters: [{ name: "dimension", in: "query", schema: { type: "string" } }],
        responses: { "200": jsonResponse("Attribution rows") },
      },
    },
    "/ai-observability/ingest-keys/{id}/rotate": {
      post: {
        tags: ["Administration"],
        summary: "Rotate an ingest key preserving scopes (admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": jsonResponse("New key secret") },
      },
    },
    "/ai-observability/webhooks": {
      get: { tags: ["Administration"], summary: "List webhooks (admin)", responses: { "200": jsonResponse("Webhooks") } },
      post: {
        tags: ["Administration"],
        summary: "Create webhook (admin) — returns one-time signing secret",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Webhook" } } } },
        responses: { "201": jsonResponse("Created") },
      },
    },
    "/ai-observability/reports": {
      post: { tags: ["Administration"], summary: "Create a shareable report link", responses: { "201": jsonResponse("Share token") } },
    },
    "/ai-observability/public/reports/{token}": {
      get: {
        tags: ["Administration"],
        summary: "Public, unauthenticated read of a shared report",
        security: [],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": jsonResponse("Report snapshot"), "404": jsonResponse("Expired/revoked/not found") },
      },
    },
    "/ai-observability/comments": {
      get: { tags: ["Collaboration"], summary: "List comments for a target", responses: { "200": jsonResponse("Comments") } },
      post: { tags: ["Collaboration"], summary: "Create a comment with @mentions/assignee", responses: { "201": jsonResponse("Created") } },
    },
  },
} as const;
