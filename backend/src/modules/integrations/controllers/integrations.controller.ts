import { Request, Response } from "express";
import { User, encryptKey, decryptKey } from "../../../models/user.model";
import { getAllProviderConnectionSummaries } from "../../../services/cloud/capabilities.service";
import { disconnectProvider } from "../../../store/workspace-credentials";
import {
  validateOpenAIKey,
  validateAnthropicKey,
  validateGeminiKey,
} from "../../../services/ai-usage.service";
import { invalidateUser } from "../../../middleware/response-cache";

// ─── Get Unified Integrations Status ──────────────────────────────
export async function getIntegrationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    // 1. AI API Keys
    const aiKeys = {
      openai: {
        connected: !!user.aiApiKeys?.openai?.apiKey,
        connectedAt: user.aiApiKeys?.openai?.connectedAt || null,
        lastFour: user.aiApiKeys?.openai?.apiKey
          ? decryptKey(user.aiApiKeys.openai.apiKey).slice(-4)
          : null,
      },
      anthropic: {
        connected: !!user.aiApiKeys?.anthropic?.apiKey,
        connectedAt: user.aiApiKeys?.anthropic?.connectedAt || null,
        lastFour: user.aiApiKeys?.anthropic?.apiKey
          ? decryptKey(user.aiApiKeys.anthropic.apiKey).slice(-4)
          : null,
      },
      gemini: {
        connected: !!user.aiApiKeys?.gemini?.apiKey,
        connectedAt: user.aiApiKeys?.gemini?.connectedAt || null,
        lastFour: user.aiApiKeys?.gemini?.apiKey
          ? decryptKey(user.aiApiKeys.gemini.apiKey).slice(-4)
          : null,
      },
      nvidia: {
        connected: !!user.aiApiKeys?.nvidia?.apiKey,
        connectedAt: user.aiApiKeys?.nvidia?.connectedAt || null,
        lastFour: user.aiApiKeys?.nvidia?.apiKey
          ? decryptKey(user.aiApiKeys.nvidia.apiKey).slice(-4)
          : null,
      },
    };

    // 2. Cloud Providers
    const cloudSummaries = await getAllProviderConnectionSummaries(userId);
    const cloud = {
      aws: {
        connected: cloudSummaries.aws.connected,
        connectedAt: cloudSummaries.aws.connectedAt || null,
        status: cloudSummaries.aws.status,
        roleArn: cloudSummaries.aws.metadata?.roleArn || null,
      },
      azure: {
        connected: cloudSummaries.azure.connected,
        connectedAt: cloudSummaries.azure.connectedAt || null,
        status: cloudSummaries.azure.status,
        subscriptionId: cloudSummaries.azure.metadata?.subscriptionId || null,
        authMode: cloudSummaries.azure.metadata?.authMode || null,
      },
      gcp: {
        connected: cloudSummaries.gcp.connected,
        connectedAt: cloudSummaries.gcp.connectedAt || null,
        status: cloudSummaries.gcp.status,
        projectId: cloudSummaries.gcp.metadata?.projectId || null,
        clientEmail: cloudSummaries.gcp.metadata?.clientEmail || null,
      },
    };

    // 3. GitHub
    const github = {
      connected: !!user.githubCredentials?.accessToken,
      connectedAt: user.githubCredentials?.connectedAt || null,
    };

    res.json({
      success: true,
      integrations: {
        aiKeys,
        cloud,
        github,
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch integrations",
      });
  }
}

// ─── Save / Update AI API Key ─────────────────────────────────────
export async function saveAiKeyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const { provider, apiKey } = req.body as {
      provider?: string;
      apiKey?: string;
    };

    if (!provider || !apiKey || !apiKey.trim()) {
      res
        .status(400)
        .json({ success: false, error: "Provider and API Key are required" });
      return;
    }

    if (!["openai", "anthropic", "gemini", "nvidia"].includes(provider)) {
      res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid provider. Must be 'openai', 'anthropic', 'gemini', or 'nvidia'",
        });
      return;
    }

    const cleanKey = apiKey.trim();

    // Validate key before saving
    let isValid = true;
    if (provider === "nvidia") {
      // Simple check that it is non-empty and has the nvapi prefix
      isValid = cleanKey.length > 5 && cleanKey.startsWith("nvapi-");
    } else {
      const validation =
        provider === "openai"
          ? await validateOpenAIKey(cleanKey)
          : provider === "anthropic"
            ? await validateAnthropicKey(cleanKey)
            : await validateGeminiKey(cleanKey);
      isValid = validation.valid;
    }

    if (!isValid) {
      res
        .status(400)
        .json({
          success: false,
          error: `Invalid ${provider} API key. Please check your credentials.`,
        });
      return;
    }

    const encrypted = encryptKey(cleanKey);
    const updatePath = `aiApiKeys.${provider}`;
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`${updatePath}.apiKey`]: encrypted,
        [`${updatePath}.connectedAt`]: new Date(),
      },
    });

    res.json({ success: true, provider, lastFour: cleanKey.slice(-4) });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to save API key",
      });
  }
}

// ─── Disconnect AI API Key ────────────────────────────────────────
export async function deleteAiKeyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const providerRaw = req.params.provider;
    const provider = Array.isArray(providerRaw) ? providerRaw[0] : providerRaw;

    if (
      !provider ||
      !["openai", "anthropic", "gemini", "nvidia"].includes(provider)
    ) {
      res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid provider. Must be 'openai', 'anthropic', 'gemini', or 'nvidia'",
        });
      return;
    }

    const updatePath = `aiApiKeys.${provider}`;
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`${updatePath}.apiKey`]: null,
        [`${updatePath}.connectedAt`]: null,
      },
    });

    res.json({ success: true, provider });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to disconnect API key",
      });
  }
}

// ─── Disconnect Cloud Provider Credentials ─────────────────────────
export async function deleteCloudHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const providerRaw = req.params.provider;
    const provider = Array.isArray(providerRaw) ? providerRaw[0] : providerRaw;

    if (!provider || !["aws", "azure", "gcp"].includes(provider)) {
      res
        .status(400)
        .json({
          success: false,
          error: "Invalid cloud provider. Must be 'aws', 'azure', or 'gcp'",
        });
      return;
    }

    await disconnectProvider(userId, provider as any);
    invalidateUser(userId); // Clear cached provider data

    res.json({ success: true, provider });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to disconnect cloud provider",
      });
  }
}

// ─── Disconnect GitHub Credentials ────────────────────────────────
export async function deleteGithubHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;

    await User.findByIdAndUpdate(userId, {
      $set: {
        githubCredentials: {
          accessToken: null as any,
          connectedAt: null as any,
        },
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to disconnect GitHub account",
      });
  }
}
