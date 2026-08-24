import axios from "axios";
import { Agent as HttpsAgent } from "https";

import { runNvidiaCompletion } from "./nvidia-playground.service";
import { normalizeAndValidateEndpoint } from "./playground-endpoint.service";
import {
  estimateTokens,
  getUpstreamErrorMessage,
  OPENAI_COMPATIBLE_URLS,
} from "./playground-utils";

export async function dispatchPlaygroundCompletion(params: any) {
  if (params.p === "nvidia") return runNvidiaCompletion(params);
  if (!params.hasCustomEndpoint && (params.p === "gemini" || params.p === "google")) {
    return runGoogleCompletion(params);
  }
  if (!params.hasCustomEndpoint && params.p === "anthropic") {
    return runAnthropicCompletion(params);
  }
  return runOpenAiCompatibleCompletion(params);
}

async function runGoogleCompletion(params: any) {
  const response = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 256,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      validateStatus: () => true,
    },
  );

  if (response.status >= 400) {
    console.error(
      "Google Gemini API Error Response:",
      JSON.stringify(response.data, null, 2),
    );
    return {
      status: response.status,
      body: {
        success: false,
        error:
          response.data?.error?.message ||
          (response.data ? JSON.stringify(response.data) : "Google Gemini call failed"),
      },
    };
  }

  const responseText = response.data.choices?.[0]?.message?.content || "";
  return {
    responseText,
    promptTokens:
      response.data.usage?.prompt_tokens ||
      estimateTokens(JSON.stringify(params.messages)),
    completionTokens:
      response.data.usage?.completion_tokens || estimateTokens(responseText),
  };
}

async function runAnthropicCompletion(params: any) {
  const filteredMessages = params.messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: params.model,
      messages: filteredMessages,
      system: params.compiledSystem || undefined,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 256,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
      },
      validateStatus: () => true,
    },
  );

  if (response.status >= 400) {
    return {
      status: response.status,
      body: {
        success: false,
        error: response.data?.error?.message || "Anthropic LLM call failed",
      },
    };
  }

  const responseText = response.data.content?.[0]?.text || "";
  return {
    responseText,
    promptTokens:
      response.data.usage?.input_tokens ||
      estimateTokens(JSON.stringify(params.messages)),
    completionTokens:
      response.data.usage?.output_tokens || estimateTokens(responseText),
  };
}

async function runOpenAiCompatibleCompletion(params: any) {
  let url = "";
  let httpsAgent: HttpsAgent | undefined;
  if (params.hasCustomEndpoint) {
    const validatedEndpoint = await normalizeAndValidateEndpoint(params.endpoint, "");
    url = validatedEndpoint.url;
    httpsAgent = validatedEndpoint.httpsAgent;
  } else if (
    params.provider.startsWith("http://") ||
    params.provider.startsWith("https://")
  ) {
    url = params.provider;
  } else if (OPENAI_COMPATIBLE_URLS[params.p]) {
    url = OPENAI_COMPATIBLE_URLS[params.p];
  } else {
    url = `https://api.${params.p}.com/v1/chat/completions`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (params.apiKey) headers["Authorization"] = `Bearer ${params.apiKey}`;

  const requestBody: any = { model: params.model, messages: params.messages };
  const isReasoningOrNewModel =
    params.model.startsWith("o1") ||
    params.model.startsWith("o3") ||
    params.model.startsWith("gpt-5") ||
    params.model.includes("reasoning");

  if (
    isReasoningOrNewModel &&
    (params.p === "openai" || params.p === "azure" || url.includes("api.openai.com"))
  ) {
    requestBody.max_completion_tokens = params.maxTokens ?? 256;
  } else {
    requestBody.temperature = params.temperature ?? 0.7;
    requestBody.max_tokens = params.maxTokens ?? 256;
  }

  const response = await axios.post(url, requestBody, {
    headers,
    maxRedirects: params.hasCustomEndpoint ? 0 : 5,
    httpsAgent,
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    return {
      status: response.status,
      body: {
        success: false,
        code:
          response.status === 429
            ? "ERR_AI_RATE_LIMITED"
            : "ERR_AI_UPSTREAM_FAILED",
        error: getUpstreamErrorMessage(params.provider, response.status, response.data),
        upstreamStatus: response.status,
        requestId: params.requestId,
      },
    };
  }

  const responseText = response.data.choices?.[0]?.message?.content || "";
  return {
    responseText,
    promptTokens:
      response.data.usage?.prompt_tokens ||
      estimateTokens(JSON.stringify(params.messages)),
    completionTokens:
      response.data.usage?.completion_tokens || estimateTokens(responseText),
  };
}
