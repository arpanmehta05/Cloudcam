import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";
import { CloudProvider } from "../../../packages/types/src";

export type PermissionLevel = "viewer" | "operator" | "admin";
export type AuthProvider = "email" | "google" | "github";

export interface IAiApiKeys {
  openai?: {
    apiKey?: string; // encrypted
    connectedAt?: Date;
  };
  anthropic?: {
    apiKey?: string; // encrypted
    connectedAt?: Date;
  };
  gemini?: {
    apiKey?: string; // encrypted
    connectedAt?: Date;
  };
  nvidia?: {
    apiKey?: string; // encrypted
    connectedAt?: Date;
  };
}

export type UsageReportFrequency = "weekly" | "monthly";

export interface IReportPreferences {
  enabled: boolean;
  frequency: UsageReportFrequency;
  lastSentAt?: Date | null;
  nextSendAt?: Date | null;
  dayOfWeek?: number; // 0-6 (Sun-Sat) for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timeOfDay?: string; // HH:mm format
  sections?: string[];
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email?: string | null;
  username?: string | null;
  name: string;
  provider: AuthProvider;
  providerId?: string | null;
  avatarUrl?: string | null;
  tenantId?: string;
  defaultWorkspaceId?: string;
  workspaces?: string[];
  passwordHash?: string | null;
  twoFactorEnabled?: boolean;
  twoFactorMethod?: "email" | "totp";
  twoFactorTotpSecret?: string | null;
  tempTwoFactorTotpSecret?: string | null;
  permissionLevel: PermissionLevel;
  isSystemAdmin?: boolean;
  requiresPasswordReset?: boolean;
  scheduledDeletionAt?: Date | null;
  accountLocked?: boolean;
  awsCredentials: {
    roleArn?: string;
    externalId?: string;
    connectedAt?: Date;
    enabledModules?: string[]; // e.g. ["core-monitoring", "cost", "security", "ai-observability"]
    logForwardingEnabled?: boolean;
  };
  azureCredentials: {
    tenantId?: string;
    subscriptionId?: string;
    billingAccountId?: string;
    principalId?: string;
    clientId?: string;
    clientSecret?: string;
    connectedAt?: Date;
    lastSyncAt?: Date;
    lastSuccessfulSyncAt?: Date;
    lastSyncStatus?: "never" | "syncing" | "ok" | "partial" | "error";
    lastError?: string;
    source?: string;
    enabledModules?: string[];
    logForwardingEnabled?: boolean;
  };
  gcpCredentials: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    billingDatasetId?: string;
    billingTableId?: string;
    connectedAt?: Date;
    enabledModules?: string[];
    logForwardingEnabled?: boolean;
  };
  githubCredentials?: {
    accessToken?: string;
    connectedAt?: Date;
  };
  cloudConnections: {
    provider: CloudProvider;
    connectionId?: string;
    credentials: {
      roleArn?: string;
      externalId?: string;
      tenantId?: string;
      subscriptionId?: string;
      billingAccountId?: string;
      clientId?: string;
      clientSecret?: string;
      principalId?: string;
      projectId?: string;
      clientEmail?: string;
      privateKey?: string;
      billingDatasetId?: string;
      billingTableId?: string;
    };
    connectedAt?: Date;
    lastSyncAt?: Date;
    lastSuccessfulSyncAt?: Date;
    lastSyncStatus?: "never" | "syncing" | "ok" | "partial" | "error";
    lastError?: string;
    source?: string;
    enabledModules?: string[];
    logForwardingEnabled?: boolean;
  }[];
  aiApiKeys: IAiApiKeys;
  usageReportPreferences: IReportPreferences;
  aiInsightPreferences: IReportPreferences;

  notificationSettings?: {
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      connectedAt?: Date;
      botToken?: string;
      signingSecret?: string;
      slackUserMappings?: {
        slackUserId: string;
        linkedAt: Date;
      }[];
    };
    email?: {
      enabled: boolean;
    };
  };
  recentLogins?: {
    provider: string;
    ip: string;
    userAgent: string;
    loggedAt: Date;
  }[];
  pinnedServices?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Simple AES-256 encryption for API keys at rest
const ENC_KEY = crypto
  .createHash("sha256")
  .update(
    process.env.JWT_SECRET || "rabbittize-dev-secret-change-in-production",
  )
  .digest();
const IV_LEN = 16;

export function encryptKey(text: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptKey(data: string): string {
  const [ivHex, encrypted] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tenantId: {
      type: String,
      default: null,
      index: true,
    },
    defaultWorkspaceId: {
      type: String,
      default: null,
    },
    workspaces: {
      type: [String],
      default: [],
    },
    provider: {
      type: String,
      enum: ["email", "google", "github"],
      default: "email",
    },
    providerId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorMethod: {
      type: String,
      enum: ["email", "totp"],
      default: "email",
    },
    twoFactorTotpSecret: {
      type: String,
      default: null,
    },
    tempTwoFactorTotpSecret: {
      type: String,
      default: null,
    },
    permissionLevel: {
      type: String,
      enum: ["viewer", "operator", "admin"],
      default: "operator",
    },
    isSystemAdmin: {
      type: Boolean,
      default: false,
    },
    requiresPasswordReset: {
      type: Boolean,
      default: false,
    },
    scheduledDeletionAt: {
      type: Date,
      default: null,
    },
    accountLocked: {
      type: Boolean,
      default: false,
    },
    awsCredentials: {
      roleArn: { type: String, default: null },
      externalId: { type: String, default: null },
      connectedAt: { type: Date, default: null },
      enabledModules: {
        type: [String],
        default: ["core-monitoring", "cost", "security"],
      },
      logForwardingEnabled: { type: Boolean, default: false },
    },
    azureCredentials: {
      tenantId: { type: String, default: null },
      subscriptionId: { type: String, default: null },
      billingAccountId: { type: String, default: null },
      principalId: { type: String, default: null },
      clientId: { type: String, default: null },
      clientSecret: { type: String, default: null },
      connectedAt: { type: Date, default: null },
      enabledModules: {
        type: [String],
        default: ["core-monitoring", "cost", "security"],
      },
      logForwardingEnabled: { type: Boolean, default: false },
    },
    gcpCredentials: {
      projectId: { type: String, default: null },
      clientEmail: { type: String, default: null },
      privateKey: { type: String, default: null },
      billingDatasetId: { type: String, default: null },
      billingTableId: { type: String, default: null },
      connectedAt: { type: Date, default: null },
      enabledModules: {
        type: [String],
        default: ["core-monitoring", "cost", "security"],
      },
      logForwardingEnabled: { type: Boolean, default: false },
    },
    githubCredentials: {
      accessToken: { type: String, default: null },
      connectedAt: { type: Date, default: null },
    },
    cloudConnections: {
      type: [
        {
          provider: {
            type: String,
            enum: ["aws", "azure", "gcp"],
            required: true,
          },
          connectionId: { type: String, default: null },
          credentials: {
            roleArn: { type: String, default: null },
            externalId: { type: String, default: null },
            tenantId: { type: String, default: null },
            subscriptionId: { type: String, default: null },
            billingAccountId: { type: String, default: null },
            clientId: { type: String, default: null },
            clientSecret: { type: String, default: null },
            principalId: { type: String, default: null },
            projectId: { type: String, default: null },
            clientEmail: { type: String, default: null },
            privateKey: { type: String, default: null },
            billingDatasetId: { type: String, default: null },
            billingTableId: { type: String, default: null },
          },
          connectedAt: { type: Date, default: null },
          lastSyncAt: { type: Date, default: null },
          lastSuccessfulSyncAt: { type: Date, default: null },
          lastSyncStatus: {
            type: String,
            enum: ["never", "syncing", "ok", "partial", "error"],
            default: "never",
          },
          lastError: { type: String, default: null },
          source: { type: String, default: null },
          enabledModules: {
            type: [String],
            default: ["core-monitoring", "cost", "security"],
          },
          logForwardingEnabled: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    aiApiKeys: {
      openai: {
        apiKey: { type: String, default: null },
        connectedAt: { type: Date, default: null },
      },
      anthropic: {
        apiKey: { type: String, default: null },
        connectedAt: { type: Date, default: null },
      },
      gemini: {
        apiKey: { type: String, default: null },
        connectedAt: { type: Date, default: null },
      },
      nvidia: {
        apiKey: { type: String, default: null },
        connectedAt: { type: Date, default: null },
      },
    },
    usageReportPreferences: {
      enabled: { type: Boolean, default: true },
      frequency: {
        type: String,
        enum: ["weekly", "monthly"],
        default: "weekly",
      },
      lastSentAt: { type: Date, default: null },
      nextSendAt: { type: Date, default: null },
      dayOfWeek: { type: Number, default: 1 }, // Default Monday
      dayOfMonth: { type: Number, default: 1 }, // Default 1st
      timeOfDay: { type: String, default: "09:00" },
      sections: {
        type: [String],
        default: ["summary", "topServices", "schedule"],
      },
    },
    aiInsightPreferences: {
      enabled: { type: Boolean, default: true },
      frequency: {
        type: String,
        enum: ["weekly", "monthly"],
        default: "weekly",
      },
      lastSentAt: { type: Date, default: null },
      nextSendAt: { type: Date, default: null },
      dayOfWeek: { type: Number, default: 1 },
      dayOfMonth: { type: Number, default: 1 },
      timeOfDay: { type: String, default: "09:00" },
      sections: {
        type: [String],
        default: ["recommendations", "diagnosis", "optimizations", "alerts"],
      },
    },

    notificationSettings: {
      slack: {
        enabled: { type: Boolean, default: false },
        webhookUrl: { type: String, default: null },
        connectedAt: { type: Date, default: null },
        botToken: { type: String, default: null },
        signingSecret: { type: String, default: null },
        slackUserMappings: {
          type: [
            {
              slackUserId: { type: String, required: true },
              linkedAt: { type: Date, default: Date.now },
            },
          ],
          default: [],
        },
      },
      email: {
        enabled: { type: Boolean, default: true },
      },
    },
    recentLogins: {
      type: [
        {
          provider: { type: String, required: true },
          ip: { type: String, required: true },
          userAgent: { type: String, required: true },
          loggedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    pinnedServices: {
      type: [String],
      default: [
        "/dashboard",
        "/watchdog",
        "/recommendations",
        "/simulations/live-canvas",
        "/vps-logs",
        "/dpdp-compliance",
        "/resize-migration",
      ],
    },
  },
  {
    timestamps: true,
  },
);

// Don't return sensitive fields in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.twoFactorTotpSecret;
  delete obj.tempTwoFactorTotpSecret;
  // Strip raw encrypted keys, expose only connection status
  if (obj.aiApiKeys?.openai?.apiKey) {
    obj.aiApiKeys.openai.apiKey = undefined;
    obj.aiApiKeys.openai.connected = true;
  }
  if (obj.aiApiKeys?.anthropic?.apiKey) {
    obj.aiApiKeys.anthropic.apiKey = undefined;
    obj.aiApiKeys.anthropic.connected = true;
  }
  if (obj.aiApiKeys?.gemini?.apiKey) {
    obj.aiApiKeys.gemini.apiKey = undefined;
    obj.aiApiKeys.gemini.connected = true;
  }
  if (obj.aiApiKeys?.nvidia?.apiKey) {
    obj.aiApiKeys.nvidia.apiKey = undefined;
    obj.aiApiKeys.nvidia.connected = true;
  }
  if (obj.azureCredentials?.clientSecret) {
    obj.azureCredentials.clientSecret = undefined;
    obj.azureCredentials.connected = true;
  }
  if (obj.awsCredentials?.externalId) {
    obj.awsCredentials.externalId = undefined;
  }
  if (obj.gcpCredentials?.privateKey) {
    obj.gcpCredentials.privateKey = undefined;
    obj.gcpCredentials.connected = true;
  }
  if (obj.githubCredentials?.accessToken) {
    obj.githubCredentials.accessToken = undefined;
    obj.githubCredentials.connected = true;
  }
  if (obj.notificationSettings?.slack?.webhookUrl) {
    obj.notificationSettings.slack.webhookUrl = undefined;
    obj.notificationSettings.slack.connected = true;
  }
  if (Array.isArray(obj.cloudConnections)) {
    obj.cloudConnections = obj.cloudConnections.map((connection: any) => {
      if (connection.credentials?.clientSecret) {
        connection.credentials.clientSecret = undefined;
        connection.credentials.connected = true;
      }
      if (connection.credentials?.externalId) {
        connection.credentials.externalId = undefined;
      }
      if (connection.credentials?.privateKey) {
        connection.credentials.privateKey = undefined;
        connection.credentials.connected = true;
      }
      return connection;
    });
  }
  return obj;
};

// Enforce global email uniqueness only for root accounts (where username is null)
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { username: null },
  },
);

// Enforce unique usernames within a tenant (where username is a string)
userSchema.index(
  { tenantId: 1, username: 1 },
  {
    unique: true,
    partialFilterExpression: { username: { $type: "string" } },
  },
);

export const User = mongoose.model<IUser>("User", userSchema);
