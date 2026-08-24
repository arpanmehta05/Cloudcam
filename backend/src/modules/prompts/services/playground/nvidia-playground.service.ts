import axios from "axios";

import { normalizeAndValidateEndpoint } from "./playground-endpoint.service";
import {
  estimateTokens,
  getUpstreamErrorMessage,
  OPENAI_COMPATIBLE_URLS,
  PLAYGROUND_UPSTREAM_TIMEOUT_MS,
} from "./playground-utils";

export async function readStreamText(
  stream: NodeJS.ReadableStream,
): Promise<string> {
  let body = "";
  for await (const chunk of stream as any) {
    body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (body.length > 20_000) break;
  }
  return body;
}

async function collectNvidiaCompletion(stream: NodeJS.ReadableStream): Promise<{
  text: string;
  reasoning: string;
  promptTokens: number;
  completionTokens: number;
}> {
  let buffer = "";
  let text = "";
  let reasoning = "";
  let promptTokens = 0;
  let completionTokens = 0;

  const processLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return false;

    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") return true;
    if (!payload) return false;

    try {
      const event = JSON.parse(payload);
      const delta = event.choices?.[0]?.delta;
      if (typeof delta?.reasoning_content === "string")
        reasoning += delta.reasoning_content;
      if (typeof delta?.content === "string") text += delta.content;

      const usage = event.usage;
      promptTokens = usage?.prompt_tokens ?? promptTokens;
      completionTokens = usage?.completion_tokens ?? completionTokens;
    } catch {
      // Ignore incomplete or non-JSON SSE control lines.
    }
    return false;
  };

  try {
    streamLoop: for await (const chunk of stream as any) {
      buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (processLine(line)) break streamLoop;
      }
    }
    if (buffer) processLine(buffer);
  } finally {
    const destroyableStream = stream as NodeJS.ReadableStream & {
      destroy?: () => void;
    };
    destroyableStream.destroy?.();
  }

  return { text, reasoning, promptTokens, completionTokens };
}

export async function runNvidiaCompletion(params: {
  endpoint: unknown;
  observedModel: string;
  messages: any[];
  temperature: unknown;
  topP: unknown;
  maxTokens: unknown;
  reasoningBudget: unknown;
  enableThinking: unknown;
  apiKey: string;
  requestId: string;
}) {
  const validatedEndpoint = await normalizeAndValidateEndpoint(
    typeof params.endpoint === "string" ? params.endpoint : "",
    OPENAI_COMPATIBLE_URLS.nvidia,
  );
  const effectiveMaxTokens = Math.min(
    Math.max(Number(params.maxTokens) || 16_384, 1),
    16_384,
  );
  const effectiveReasoningBudget = Math.min(
    Math.max(Number(params.reasoningBudget) || effectiveMaxTokens, 1),
    effectiveMaxTokens,
  );
  const requestedTemperature = Number(params.temperature);
  const effectiveTemperature = Number.isFinite(requestedTemperature)
    ? Math.min(Math.max(requestedTemperature, 0), 1)
    : 1;
  const response = await axios.post(
    validatedEndpoint.url,
    {
      model: params.observedModel,
      messages: params.messages,
      temperature: effectiveTemperature,
      top_p: typeof params.topP === "number" ? params.topP : 0.95,
      max_tokens: effectiveMaxTokens,
      chat_template_kwargs: {
        enable_thinking: params.enableThinking !== false,
      },
      reasoning_budget: effectiveReasoningBudget,
      stream: true,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${params.apiKey}`,
      },
      responseType: "stream",
      timeout: PLAYGROUND_UPSTREAM_TIMEOUT_MS,
      maxRedirects: 0,
      httpsAgent: validatedEndpoint.httpsAgent,
      validateStatus: () => true,
    },
  );

  if (response.status >= 400) {
    const upstreamBody = await readStreamText(response.data);
    return {
      status: response.status,
      body: {
        success: false,
        code:
          response.status === 429
            ? "ERR_AI_RATE_LIMITED"
            : "ERR_AI_UPSTREAM_FAILED",
        error: getUpstreamErrorMessage("NVIDIA", response.status, upstreamBody),
        upstreamStatus: response.status,
        requestId: params.requestId,
      },
    };
  }

  const completion = await collectNvidiaCompletion(response.data);
  const responseText = [completion.reasoning, completion.text]
    .filter(Boolean)
    .join("\n\n");
  if (!responseText.trim()) {
    return {
      status: 502,
      body: {
        success: false,
        code: "ERR_AI_UPSTREAM_FAILED",
        error:
          "NVIDIA completed the request without returning text or reasoning content.",
        requestId: params.requestId,
      },
    };
  }

  return {
    responseText,
    promptTokens:
      completion.promptTokens || estimateTokens(JSON.stringify(params.messages)),
    completionTokens:
      completion.completionTokens ||
      estimateTokens(`${completion.reasoning}${completion.text}`),
  };
}
