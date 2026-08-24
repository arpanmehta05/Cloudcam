import { AppError } from "../../../../core/errors";
import type { TraceEnvelope } from "./trace-ingestion.service";

type AttributeValue =
  | { stringValue?: string; intValue?: number | string; doubleValue?: number | string; boolValue?: boolean }
  | { arrayValue?: { values?: AttributeValue[] } }
  | { kvlistValue?: { values?: Array<{ key: string; value?: AttributeValue }> } };

interface OTelAttribute {
  key: string;
  value?: AttributeValue;
}

interface OTelSpan {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: string | number;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OTelAttribute[];
  status?: { code?: number | string; message?: string };
}

interface OTelScopeSpans {
  scope?: { name?: string; version?: string };
  instrumentationScope?: { name?: string; version?: string };
  spans?: OTelSpan[];
}

interface OTelResourceSpans {
  resource?: { attributes?: OTelAttribute[] };
  scopeSpans?: OTelScopeSpans[];
  instrumentationLibrarySpans?: OTelScopeSpans[];
}

export interface OTelTracePayload {
  resourceSpans?: OTelResourceSpans[];
}

function badRequest(message: string): AppError {
  return new AppError({ code: "ERR_BAD_REQUEST", message, status: 400 });
}

function attrValue(value: AttributeValue | undefined): unknown {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("intValue" in value) return Number(value.intValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("boolValue" in value) return value.boolValue;
  if ("arrayValue" in value) return value.arrayValue?.values?.map(attrValue) || [];
  if ("kvlistValue" in value) {
    return (value.kvlistValue?.values || []).reduce<Record<string, unknown>>((result, item) => {
      result[item.key] = attrValue(item.value);
      return result;
    }, {});
  }
  return undefined;
}

function attrs(attributes: OTelAttribute[] | undefined): Record<string, unknown> {
  return (attributes || []).reduce<Record<string, unknown>>((result, item) => {
    if (!item.key) return result;
    const value = attrValue(item.value);
    if (value !== undefined) result[item.key] = value;
    return result;
  }, {});
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nanoToDate(value: unknown): string | undefined {
  const nanos = numberValue(value);
  if (!nanos) return undefined;
  return new Date(Math.floor(nanos / 1_000_000)).toISOString();
}

function durationMs(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

type TraceSpanInput = NonNullable<TraceEnvelope["spans"]>[number];

function mapKind(span: OTelSpan, attributes: Record<string, unknown>): TraceSpanInput["kind"] {
  const aiKind = text(attributes["gen_ai.operation.name"]) || text(attributes["ai.operation"]);
  if (aiKind === "chat" || aiKind === "completion" || aiKind === "generate") return "llm";
  if (aiKind === "embedding") return "embedding";
  if (aiKind === "retrieval") return "retrieval";
  if (text(attributes["tool.name"])) return "tool";
  if (text(attributes["db.system"]) || text(attributes["http.method"])) return "custom";
  return "custom";
}

function status(span: OTelSpan): "success" | "error" {
  return Number(span.status?.code) === 2 ? "error" : "success";
}

function traceName(span: OTelSpan, attributes: Record<string, unknown>): string {
  return text(attributes["service.name"]) || text(attributes["http.route"]) || span.name || "otel.trace";
}

function spanModel(attributes: Record<string, unknown>): string | undefined {
  return text(attributes["gen_ai.response.model"])
    || text(attributes["gen_ai.request.model"])
    || text(attributes["llm.model_name"])
    || text(attributes["model"]);
}

export function mapOtelToTraceEnvelopes(payload: OTelTracePayload): TraceEnvelope[] {
  if (!Array.isArray(payload?.resourceSpans)) throw badRequest("resourceSpans array is required");

  const traces = new Map<string, TraceEnvelope>();
  for (const resourceSpan of payload.resourceSpans) {
    const resourceAttrs = attrs(resourceSpan.resource?.attributes);
    const scopeGroups = resourceSpan.scopeSpans || resourceSpan.instrumentationLibrarySpans || [];
    for (const scopeSpan of scopeGroups) {
      const scope = scopeSpan.scope || scopeSpan.instrumentationScope || {};
      for (const span of scopeSpan.spans || []) {
        if (!span.traceId || !span.spanId) continue;
        const spanAttrs = { ...resourceAttrs, ...attrs(span.attributes) };
        const startedAt = nanoToDate(span.startTimeUnixNano);
        const endedAt = nanoToDate(span.endTimeUnixNano);
        const existing = traces.get(span.traceId);
        const envelope = existing || {
          trace: {
            traceId: span.traceId,
            name: traceName(span, spanAttrs),
            serviceName: text(spanAttrs["service.name"]),
            endpoint: text(spanAttrs["http.route"]) || text(spanAttrs["url.path"]) || text(spanAttrs["http.target"]),
            environment: text(spanAttrs["deployment.environment"]) || text(spanAttrs["environment"]),
            sessionId: text(spanAttrs["session.id"]) || text(spanAttrs["gen_ai.session.id"]),
            endUserId: text(spanAttrs["enduser.id"]) || text(spanAttrs["user.id"]),
            startedAt,
            tags: ["otel"],
            metadata: { source: "otel", scopeName: scope.name, scopeVersion: scope.version },
          },
          spans: [],
        };
        envelope.spans?.push({
          spanId: span.spanId,
          parentSpanId: text(span.parentSpanId),
          name: span.name || spanModel(spanAttrs) || "otel.span",
          kind: mapKind(span, spanAttrs),
          provider: text(spanAttrs["gen_ai.system"]) || text(spanAttrs["llm.provider"]) || "custom",
          modelName: spanModel(spanAttrs),
          status: status(span),
          statusMessage: span.status?.message,
          startedAt,
          endedAt,
          durationMs: durationMs(startedAt, endedAt),
          promptTokens: numberValue(spanAttrs["gen_ai.usage.input_tokens"] || spanAttrs["llm.usage.prompt_tokens"]),
          completionTokens: numberValue(spanAttrs["gen_ai.usage.output_tokens"] || spanAttrs["llm.usage.completion_tokens"]),
          totalTokens: numberValue(spanAttrs["gen_ai.usage.total_tokens"] || spanAttrs["llm.usage.total_tokens"]),
          inputPreview: text(spanAttrs["gen_ai.prompt"]) || text(spanAttrs["input.value"]),
          outputPreview: text(spanAttrs["gen_ai.completion"]) || text(spanAttrs["output.value"]),
          prompt: {
            name: spanAttrs["prompt.name"],
            version: spanAttrs["prompt.version"],
            label: spanAttrs["prompt.label"],
            hash: spanAttrs["prompt.hash"],
          },
          metadata: { source: "otel", attributes: spanAttrs },
        });
        traces.set(span.traceId, envelope);
      }
    }
  }

  return Array.from(traces.values());
}
