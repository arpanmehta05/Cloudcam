import { User, encryptKey, decryptKey } from "../../../models/user.model";
import { logger } from "../../../core/logger";

export interface SlackSettingsInput {
  enabled?: boolean;
  webhookUrl?: string | null;
  botToken?: string | null;
  signingSecret?: string | null;
}

export interface EmailSettingsInput {
  enabled?: boolean;
}

export async function getNotificationSettings(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const settings = user.notificationSettings || {
    slack: {
      enabled: false,
      webhookUrl: undefined,
      connectedAt: undefined,
      botToken: undefined,
      signingSecret: undefined,
    },
    email: { enabled: true },
  };

  const slackConnected = !!settings.slack?.webhookUrl;
  const botConnected = !!settings.slack?.botToken;
  const secretConnected = !!settings.slack?.signingSecret;
  let lastFour: string | null = null;
  if (slackConnected && settings.slack?.webhookUrl) {
    try {
      const decrypted = decryptKey(settings.slack.webhookUrl);
      lastFour = decrypted.slice(-4);
    } catch (err: any) {
      logger.error(`Failed to decrypt Slack webhook URL for user ${userId}: ${err.message}`);
    }
  }

  return {
    slack: {
      enabled: settings.slack?.enabled ?? false,
      connected: slackConnected,
      connectedAt: settings.slack?.connectedAt || null,
      lastFour,
      botConnected,
      secretConnected,
    },
    email: {
      enabled: settings.email?.enabled ?? true,
    },
  };
}

export async function updateNotificationSettings(
  userId: string,
  input: { slack?: SlackSettingsInput; email?: EmailSettingsInput }
) {
  const { slack, email } = input;
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const currentSettings = user.notificationSettings || {
    slack: {
      enabled: false,
      webhookUrl: undefined,
      connectedAt: undefined,
      botToken: undefined,
      signingSecret: undefined,
      slackUserMappings: [],
    },
    email: { enabled: true },
  };

  const nextSettings = {
    slack: {
      enabled: currentSettings.slack?.enabled ?? false,
      webhookUrl: currentSettings.slack?.webhookUrl || null,
      connectedAt: currentSettings.slack?.connectedAt || null,
      botToken: currentSettings.slack?.botToken || null,
      signingSecret: currentSettings.slack?.signingSecret || null,
      slackUserMappings: currentSettings.slack?.slackUserMappings || [],
    },
    email: {
      enabled: currentSettings.email?.enabled ?? true,
    },
  };

  if (email && email.enabled !== undefined) {
    nextSettings.email.enabled = !!email.enabled;
  }

  if (slack) {
    if (slack.enabled !== undefined) {
      nextSettings.slack.enabled = !!slack.enabled;
    }
    if (slack.webhookUrl !== undefined) {
      const url = slack.webhookUrl?.trim();
      if (url) {
        if (!url.startsWith("https://hooks.slack.com/services/")) {
          throw new Error("Slack webhook URL must start with https://hooks.slack.com/services/");
        }
        nextSettings.slack.webhookUrl = encryptKey(url);
        nextSettings.slack.connectedAt = new Date();
      } else if (slack.webhookUrl === null || slack.webhookUrl === "") {
        nextSettings.slack.webhookUrl = null as any;
        nextSettings.slack.connectedAt = null as any;
        nextSettings.slack.enabled = false;
      }
    }
    if (slack.botToken !== undefined) {
      const token = slack.botToken?.trim();
      if (token) {
        if (!token.startsWith("xoxb-")) {
          throw new Error("Slack Bot OAuth Token must start with xoxb-");
        }
        nextSettings.slack.botToken = encryptKey(token);
      } else if (slack.botToken === null || slack.botToken === "") {
        nextSettings.slack.botToken = null as any;
      }
    }
    if (slack.signingSecret !== undefined) {
      const secret = slack.signingSecret?.trim();
      if (secret) {
        nextSettings.slack.signingSecret = encryptKey(secret);
      } else if (slack.signingSecret === null || slack.signingSecret === "") {
        nextSettings.slack.signingSecret = null as any;
      }
    }
  }

  user.notificationSettings = nextSettings as any;
  await user.save();

  const slackConnected = !!nextSettings.slack.webhookUrl;
  const botConnected = !!nextSettings.slack.botToken;
  const secretConnected = !!nextSettings.slack.signingSecret;
  let lastFour: string | null = null;
  if (slackConnected && nextSettings.slack.webhookUrl) {
    const decrypted = decryptKey(nextSettings.slack.webhookUrl);
    lastFour = decrypted.slice(-4);
  }

  return {
    slack: {
      enabled: nextSettings.slack.enabled,
      connected: slackConnected,
      connectedAt: nextSettings.slack.connectedAt,
      lastFour,
      botConnected,
      secretConnected,
    },
    email: {
      enabled: nextSettings.email.enabled,
    },
  };
}
