export const PLAYGROUND_UPSTREAM_TIMEOUT_MS = 2 * 60 * 1000;
export const PLAYGROUND_REQUEST_TIMEOUT_MS =
  PLAYGROUND_UPSTREAM_TIMEOUT_MS + 30_000;

export const OPENAI_COMPATIBLE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  cohere: "https://api.cohere.ai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  ollama: "http://localhost:11434/v1/chat/completions",
  lmstudio: "http://localhost:1234/v1/chat/completions",
  localai: "http://localhost:8080/v1/chat/completions",
  perplexity: "https://api.perplexity.ai/chat/completions",
  novita: "https://api.novita.ai/v3/openai/chat/completions",
  hyperbolic: "https://api.hyperbolic.xyz/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
};

export function compileTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  if (!template) return "";
  let compiled = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    compiled = compiled.replace(regex, value);
  }
  return compiled;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function normalizePlaygroundProvider(provider: string, model: string): string {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedModel = model.trim().toLowerCase();

  if (
    normalizedModel.startsWith("nvidia/") ||
    normalizedModel.includes("nemotron")
  ) {
    return "nvidia";
  }

  return normalizedProvider;
}

export function getUpstreamErrorMessage(
  provider: string,
  statusCode: number,
  data: any,
): string {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return data.slice(0, 1000);
    }
  }

  return String(
    data?.error?.message ||
      data?.detail ||
      data?.message ||
      `${provider} upstream returned HTTP ${statusCode}`,
  ).slice(0, 1000);
}
