// AI Keys Key Store Service — manages encrypting, decrypting, and storing user API keys.
import { User, encryptKey } from "../../../models/user.model";
import {
  validateOpenAIKey,
  validateAnthropicKey,
  validateGeminiKey,
} from "./usage.service";

export interface KeyValidationResult {
  valid: boolean;
  models: string[];
}

/**
 * Validates an API key against the provider.
 */
export async function validateKey(provider: string, apiKey: string): Promise<KeyValidationResult> {
  if (provider === "nvidia") {
    return {
      valid: apiKey.length > 5 && apiKey.startsWith("nvapi-"),
      models: [
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        "nvidia/llama-3.1-nemotron-70b-instruct",
      ],
    };
  }

  const valResult =
    provider === "openai"
      ? await validateOpenAIKey(apiKey)
      : provider === "anthropic"
        ? await validateAnthropicKey(apiKey)
        : await validateGeminiKey(apiKey);

  return {
    valid: valResult.valid,
    models: valResult.models ?? [],
  };
}

/**
 * Saves or updates an API key for a user.
 */
export async function saveApiKey(userId: string, provider: string, apiKey: string): Promise<KeyValidationResult> {
  const validation = await validateKey(provider, apiKey);
  if (!validation.valid) {
    throw new Error(`Invalid ${provider} API key`);
  }

  const encrypted = encryptKey(apiKey);
  const updatePath = `aiApiKeys.${provider}`;
  await User.findByIdAndUpdate(userId, {
    $set: {
      [`${updatePath}.apiKey`]: encrypted,
      [`${updatePath}.connectedAt`]: new Date(),
    },
  });

  return validation;
}

/**
 * Deletes/removes an API key for a user.
 */
export async function deleteApiKey(userId: string, provider: string): Promise<void> {
  const updatePath = `aiApiKeys.${provider}`;
  await User.findByIdAndUpdate(userId, {
    $set: {
      [`${updatePath}.apiKey`]: null,
      [`${updatePath}.connectedAt`]: null,
    },
  });
}

/**
 * Retrieves the connection status of all keys for a user.
 */
export async function getKeysStatus(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  return {
    openai: {
      connected: !!user.aiApiKeys?.openai?.apiKey,
      connectedAt: user.aiApiKeys?.openai?.connectedAt || null,
    },
    anthropic: {
      connected: !!user.aiApiKeys?.anthropic?.apiKey,
      connectedAt: user.aiApiKeys?.anthropic?.connectedAt || null,
    },
    gemini: {
      connected: !!user.aiApiKeys?.gemini?.apiKey,
      connectedAt: user.aiApiKeys?.gemini?.connectedAt || null,
    },
    nvidia: {
      connected: !!user.aiApiKeys?.nvidia?.apiKey,
      connectedAt: user.aiApiKeys?.nvidia?.connectedAt || null,
    },
  };
}
