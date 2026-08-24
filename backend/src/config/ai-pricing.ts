export interface ModelPricing {
  input: number; // USD per 1M input tokens
  output: number; // USD per 1M output tokens
}

// ─── OpenAI ───
export const OPENAI_PRICING: Record<string, ModelPricing> = {
  // GPT-5 family
  "gpt-5.5": { input: 5, output: 30 },
  "gpt-5.4": { input: 2.5, output: 15 },
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  // GPT-4o family
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o-search-preview": { input: 2.5, output: 10 },
  "gpt-4o-mini-search-preview": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  // Reasoning models
  o1: { input: 15, output: 60 },
  "o1-mini": { input: 3, output: 12 },
  "o3-mini": { input: 1.1, output: 4.4 },
  // Embeddings (input-only; no completion tokens)
  "text-embedding-3-large": { input: 0.13, output: 0 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-ada-002": { input: 0.1, output: 0 },
};

// ─── Anthropic / Claude ───
export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 1, output: 5 },
  "claude-3-opus-20240229": { input: 15, output: 75 },
  "claude-3-sonnet-20240229": { input: 3, output: 15 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
};

// ─── Google Gemini ───
export const GEMINI_PRICING: Record<string, ModelPricing> = {
  // Gemini 3 family (≤200k context tier; long-context tiers priced higher)
  "gemini-3-pro": { input: 2, output: 12 },
  "gemini-3.1-pro": { input: 2, output: 12 },
  "gemini-3.1-pro-preview": { input: 2, output: 12 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-3-flash": { input: 0.5, output: 3 },
  "gemini-3-flash-preview": { input: 0.5, output: 3 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
  // Gemini 2.x family
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
};

// ─── AWS Bedrock ───
// Bedrock model IDs use the format: provider.model-name-version
// Prices are on-demand; provisioned throughput pricing differs.
export const BEDROCK_PRICING: Record<string, ModelPricing> = {
  // Anthropic on Bedrock (Claude 4.x matches direct API on-demand rates)
  "anthropic.claude-opus-4-8": { input: 5, output: 25 },
  "anthropic.claude-sonnet-5": { input: 3, output: 15 },
  "anthropic.claude-haiku-4-5": { input: 1, output: 5 },
  "anthropic.claude-3-5-sonnet-20241022-v2:0": { input: 3, output: 15 },
  "anthropic.claude-3-5-haiku-20241022-v1:0": { input: 1, output: 5 },
  "anthropic.claude-3-opus-20240229-v1:0": { input: 15, output: 75 },
  "anthropic.claude-3-sonnet-20240229-v1:0": { input: 3, output: 15 },
  "anthropic.claude-3-haiku-20240307-v1:0": { input: 0.25, output: 1.25 },
  // Amazon Titan
  "amazon.titan-text-express-v1": { input: 0.2, output: 0.6 },
  "amazon.titan-text-lite-v1": { input: 0.15, output: 0.2 },
  "amazon.titan-text-premier-v1:0": { input: 0.5, output: 1.5 },
  // Meta Llama
  "meta.llama3-1-70b-instruct-v1:0": { input: 0.72, output: 0.72 },
  "meta.llama3-1-8b-instruct-v1:0": { input: 0.22, output: 0.22 },
  "meta.llama3-2-90b-instruct-v1:0": { input: 0.72, output: 0.72 },
  // Mistral
  "mistral.mistral-large-2407-v1:0": { input: 4, output: 12 },
  "mistral.mistral-small-2402-v1:0": { input: 1, output: 3 },
  "mistral.mixtral-8x7b-instruct-v0:1": { input: 0.45, output: 0.7 },
};

// ─── NVIDIA NIM ───
export const NVIDIA_PRICING: Record<string, ModelPricing> = {
  "nvidia/llama-3.1-nemotron-70b-instruct": { input: 0.7, output: 0.9 },
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": { input: 1.2, output: 1.6 },
  "nvidia/nemotron-4-340b-instruct": { input: 1.5, output: 2.0 },
  "nvidia/nemotron-3-ultra-550b-a55b": { input: 2.0, output: 2.5 },
  "nvidia/google/gemma-4-31b-it": { input: 0.35, output: 0.45 },
  "google/gemma-4-31b-it": { input: 0.35, output: 0.45 },
};

// ─── Provider pricing map ───
// Lookup by provider → model → pricing
const PRICING_BY_PROVIDER: Record<string, Record<string, ModelPricing>> = {
  openai: OPENAI_PRICING,
  anthropic: ANTHROPIC_PRICING,
  gemini: GEMINI_PRICING,
  bedrock: BEDROCK_PRICING,
  nvidia: NVIDIA_PRICING,
};

/**
 * Estimate cost for a request given provider, model, and token counts.
 * Returns { cost, estimated } where estimated=false if model pricing is unknown.
 *
 * Cost formula: (promptTokens/1_000_000 × inputRate) + (completionTokens/1_000_000 × outputRate)
 */
export function estimateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): { cost: number; estimated: boolean } {
  const providerPricing = PRICING_BY_PROVIDER[provider];
  if (!providerPricing) {
    return { cost: 0, estimated: false };
  }

  // Try exact match first, then fuzzy prefix match for versioned models
  let pricing = providerPricing[model];
  if (!pricing) {
    // Try matching by prefix (e.g. "gpt-4o-2024-08-06" → "gpt-4o")
    const modelBase = model
      .replace(/-\d{4}-\d{2}-\d{2}.*$/, "")
      .replace(/-preview$/, "");
    pricing = providerPricing[modelBase];
  }
  if (!pricing) {
    // Try matching Bedrock-style model IDs by stripping version suffix
    const bedrockBase = model.replace(/:[^:]*$/, "").replace(/-v\d+$/, "");
    pricing = providerPricing[bedrockBase];
  }

  if (!pricing) {
    return { cost: 0, estimated: false };
  }

  const cost =
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output;

  return { cost: Math.round(cost * 1_000_000) / 1_000_000, estimated: true };
}

/**
 * Get the full pricing table for a provider.
 */
export function getProviderPricing(
  provider: string,
): Record<string, ModelPricing> | null {
  return PRICING_BY_PROVIDER[provider] || null;
}
