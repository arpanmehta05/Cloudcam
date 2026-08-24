# RabbittWatch AI Observability — Public API Reference

All ingestion endpoints authenticate with an ingest key sent as the
`X-Rabbittize-Ingest-Key` header. Read/registry endpoints accept the same key
(with the appropriate scope) or a session cookie.

Base URL: `https://rabbitize-api.rabbitt.ai` (override with `RABBITTWATCH_ENDPOINT`).

Machine-readable contract: the published **OpenAPI 3.1** spec is served at
`GET /api/ai-observability/openapi.json` (public, no auth) and can be loaded into
Swagger UI, Postman, or an OpenAPI client generator.

## Ingestion (ingest key)

| Method | Path | Scope | Body |
| --- | --- | --- | --- |
| POST | `/api/ai-observability/traces` | `traces:write` | `{ trace, spans[] }` envelope |
| POST | `/api/ai-observability/traces/batch` | `traces:write` | `{ traces: [envelope, …] }` |
| POST | `/api/ai-observability/otel/v1/traces` | `traces:write` | OTLP `{ resourceSpans[] }` |
| POST | `/api/ai-observability/events` | `events:write` | single generation event |
| POST | `/api/ai-observability/events/batch` | `events:write` | `{ events: [...] }` |
| POST | `/api/ai-observability/scores` | `scores:write` | score or `{ scores: [...] }` |

### Trace envelope

```json
{
  "trace": { "traceId": "…", "name": "chat", "serviceName": "app", "environment": "prod",
             "sessionId": "…", "endUserId": "…", "prompt": { "slug": "…", "version": "…" } },
  "spans": [{ "spanId": "…", "name": "openai.chat", "kind": "llm", "provider": "openai",
              "model": "gpt-4o", "status": "success", "startedAt": "…", "endedAt": "…",
              "completionStartTime": "…", "promptTokens": 12, "completionTokens": 4 }]
}
```

`completionStartTime` records time-to-first-token for streaming spans.

### Score payload

```json
{ "name": "helpfulness", "targetType": "trace", "dataType": "numeric",
  "traceId": "…", "score": 92, "comment": "grounded" }
```

`dataType` is `numeric` (`score`), `boolean` (`boolValue`), or `categorical`/`text` (`stringValue`).

## Prompt registry

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/prompts/registry/:slug/resolve` | `?version=` `?label=` `?environment=` `?state=` |
| GET | `/api/prompts/registry` | list templates |
| POST | `/api/prompts/registry` | create template |
| GET | `/api/prompts/registry/:templateId/versions` | list versions |
| POST | `/api/prompts/registry/:templateId/versions` | create version |
| POST | `/api/prompts/registry/:templateId/versions/:versionId/promote` | promote to production |
| POST | `/api/prompts/registry/:templateId/rollback` | `{ toVersion }` |
| POST | `/api/prompts/registry/:templateId/labels/:label` | `{ versionId }` bind label |
| GET | `/api/prompts/registry/:templateId/compare` | `?from=&to=` diff |
| GET | `/api/prompts/registry/:templateId/deployments` | deployment history |
| GET | `/api/prompts/registry/:templateId/metrics` | `?hours=` per-version metrics |

## Evaluations

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/api/evaluations/evaluators` | list / create evaluators (code / llm_judge) |
| PATCH | `/api/evaluations/evaluators/:id` | update |
| POST | `/api/evaluations/evaluators/:id/archive` | archive |

## Cost

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/ai-observability/costs` | trends + breakdown |
| GET | `/api/ai-observability/costs/attribution` | `?dimension=prompt\|user\|session\|endpoint\|model\|service&days=` |
| GET | `/api/ai-observability/costs/evaluation` | judge run cost |

## CLI

```text
ai-observability doctor              # check config + connectivity
ai-observability send-test-trace     # send a sample trace
ai-observability prompt pull <name>  # resolve a prompt version
ai-observability prompt diff <name>  # print resolved template
ai-observability export traces       # export recent traces as JSON
```

Environment: `RABBITTWATCH_API_KEY`, `RABBITTWATCH_ENDPOINT`.
