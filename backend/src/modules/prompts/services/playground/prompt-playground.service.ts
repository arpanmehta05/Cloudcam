import { User, decryptKey } from "../../../../models/user.model";
import * as ingestionService from "../../../../services/ai-provider-ingestion.service";
import { dispatchPlaygroundCompletion } from "./playground-provider-dispatch.service";
import {
  compileTemplate,
  normalizePlaygroundProvider,
} from "./playground-utils";

export { normalizePlaygroundProvider };

type PlaygroundResult =
  | { status: number; body: Record<string, unknown> }
  | {
      status?: never;
      body: {
        success: true;
        requestId: string;
        text: string;
        usage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
        latencyMs: number;
      };
    };

export async function runPlaygroundRequest(params: {
  userId: string;
  body: any;
  requestId: string;
  startTime: number;
}): Promise<PlaygroundResult> {
  const {
    template,
    systemPrompt,
    provider,
    model,
    endpoint,
    temperature,
    topP,
    maxTokens,
    reasoningBudget,
    enableThinking,
    variables,
    apiKey: customApiKey,
  } = params.body;

  if (!template || !provider || !model) {
    return {
      status: 400,
      body: {
        success: false,
        code: "ERR_BAD_REQUEST",
        error: "template, provider, and model are required",
        requestId: params.requestId,
      },
    };
  }

  const vars = variables || {};
  const compiledTemplate = compileTemplate(template, vars);
  const compiledSystem = systemPrompt ? compileTemplate(systemPrompt, vars) : "";

  const user = await User.findById(params.userId);
  if (!user) {
    return { status: 404, body: { success: false, error: "User not found" } };
  }

  const p = normalizePlaygroundProvider(provider, model);
  const observedModel =
    p === "nvidia" && !model.trim().toLowerCase().startsWith("nvidia/")
      ? `nvidia/${model.trim()}`
      : model.trim();
  const hasCustomEndpoint =
    typeof endpoint === "string" && endpoint.trim().length > 0;
  const apiKey = resolveApiKey({
    customApiKey,
    userKeys: user.aiApiKeys,
    provider: p,
  });

  if (!apiKey && !isLocalProvider(p)) {
    return {
      status: 400,
      body: {
        success: false,
        code: "ERR_AI_PROVIDER_NOT_CONFIGURED",
        error: `API key for '${provider}' is not configured. Enter it in the playground settings panel or define the ${p.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_API_KEY environment variable.`,
        requestId: params.requestId,
      },
    };
  }

  const messages: any[] = [];
  if (compiledSystem) {
    messages.push({ role: "system", content: compiledSystem });
  }
  messages.push({ role: "user", content: compiledTemplate });

  const completion = await dispatchPlaygroundCompletion({
    p,
    provider,
    model,
    observedModel,
    endpoint,
    temperature,
    topP,
    maxTokens,
    reasoningBudget,
    enableThinking,
    apiKey,
    hasCustomEndpoint,
    compiledSystem,
    messages,
    requestId: params.requestId,
  });
  if (typeof completion.status === "number") {
    return { status: completion.status, body: completion.body };
  }

  const latencyMs = Date.now() - params.startTime;
  ingestionService
    .record({
      userId: params.userId,
      provider: p,
      model: observedModel,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      latencyMs,
      status: "success",
      inputPreview: JSON.stringify(messages),
      outputPreview: completion.responseText,
      environment: "playground",
      serviceName: "playground",
    })
    .catch((err) => console.error("[playground] Logging error:", err));

  return {
    body: {
      success: true,
      requestId: params.requestId,
      text: completion.responseText,
      usage: {
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        totalTokens: completion.promptTokens + completion.completionTokens,
      },
      latencyMs,
    },
  };
}

function resolveApiKey(params: {
  customApiKey: unknown;
  userKeys: unknown;
  provider: string;
}): string {
  let apiKey =
    typeof params.customApiKey === "string" ? params.customApiKey.trim() : "";
  if (apiKey) return apiKey;

  const userKeys = params.userKeys as any;
  let keyObj = userKeys?.[params.provider];
  if (!keyObj) {
    const matchKey = Object.keys(userKeys || {}).find(
      (k) => k.toLowerCase() === params.provider,
    );
    if (matchKey) keyObj = userKeys[matchKey];
  }
  if (keyObj && keyObj.apiKey) return decryptKey(keyObj.apiKey);

  if (params.provider.startsWith("http://") || params.provider.startsWith("https://")) {
    return process.env.OPENAI_API_KEY || "";
  }
  const envKeyName = `${params.provider.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase()}_API_KEY`;
  apiKey = process.env[envKeyName] || "";
  if (!apiKey && params.provider === "gemini") {
    apiKey = process.env.GEMINI_API_KEY || "";
  }
  return apiKey;
}

function isLocalProvider(provider: string): boolean {
  return (
    provider.startsWith("http://localhost") ||
    provider.startsWith("http://127.0.0.1") ||
    provider === "ollama" ||
    provider === "lmstudio" ||
    provider === "localai"
  );
}
