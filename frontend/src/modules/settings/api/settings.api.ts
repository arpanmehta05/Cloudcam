import { authFetch, authFetchJson } from "@/lib/auth-fetch";
import { z } from "zod";
import { AllPreferences, PreferenceSet, ReportType } from "../types";

export const settingsApi = {
  // --- AWS Settings ---
  saveAwsRole: async (roleArn: string, externalId: string) => {
    const res = await authFetch("/api/aws/save-role", {
      method: "POST",
      body: JSON.stringify({ roleArn, externalId }),
    });
    return res.json() as Promise<{ success: boolean; error?: string }>;
  },

  getAwsCredentials: async () => {
    const res = await authFetch("/api/aws/credentials");
    return res.json() as Promise<{
      connected: boolean;
      roleArn: string | null;
      connectedAt: string | null;
    }>;
  },

  setupAws: async (enableAiObservability: boolean, enableLogForwarding: boolean) => {
    const res = await authFetch("/api/aws/setup", {
      method: "POST",
      body: JSON.stringify({ enableAiObservability, enableLogForwarding }),
    });
    return res.json() as Promise<{ success: boolean; quickCreateUrl?: string; error?: string }>;
  },

  disconnectAws: async () => {
    const res = await authFetch("/api/aws/credentials", {
      method: "DELETE",
    });
    return res.json() as Promise<{ success: boolean; error?: string }>;
  },

  // --- Azure Settings ---
  getAzureCredentials: async () => {
    const res = await authFetch("/api/azure/credentials");
    return res.json() as Promise<{
      connected: boolean;
      tenantId: string | null;
      subscriptionId: string | null;
      billingAccountId: string | null;
      clientId: string | null;
      connectedAt: string | null;
    }>;
  },

  setupAzure: async (enabledModules: string[], oneClickDetails?: {
    tenantId: string;
    subscriptionId: string;
    principalId: string;
    enableLogAnalytics: boolean;
  }) => {
    const body = oneClickDetails
      ? { ...oneClickDetails, enabledModules }
      : { enabledModules };
    const res = await authFetch("/api/azure/setup", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{
      success: boolean;
      deployUrl?: string;
      cloudShellScript?: string;
      terraformTemplate?: string;
      webhookUrl?: string;
      webhookSecret?: string;
      error?: string;
    }>;
  },

  getAzureTemplate: async () => {
    const res = await authFetch("/api/azure/template");
    return res.json();
  },

  saveAzureConnection: async (payload: {
    tenantId: string;
    subscriptionId: string;
    billingAccountId?: string;
    enabledModules: string[];
    clientId?: string;
    clientSecret?: string;
    principalId?: string;
  }) => {
    const res = await authFetch("/api/azure/save-connection", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<{
      success: boolean;
      connection: {
        tenantId: string;
        subscriptionId: string;
        billingAccountId?: string | null;
        clientId?: string | null;
        connectedAt: string;
      };
      error?: string;
    }>;
  },

  disconnectAzure: async () => {
    const res = await authFetch("/api/azure/credentials", {
      method: "DELETE",
    });
    return res.json() as Promise<{ success: boolean; error?: string }>;
  },

  // --- GCP Settings ---
  getGcpCredentials: async () => {
    const res = await authFetch("/api/gcp/credentials");
    return res.json() as Promise<{
      connected: boolean;
      projectId: string | null;
      clientEmail: string | null;
      billingDatasetId: string | null;
      billingTableId: string | null;
      connectedAt: string | null;
    }>;
  },

  setupGcp: async (enabledModules: string[]) => {
    const res = await authFetch("/api/gcp/setup", {
      method: "POST",
      body: JSON.stringify({ enabledModules }),
    });
    return res.json() as Promise<{
      success: boolean;
      cloudShellScript: string;
      terraformTemplate: string;
      webhookUrl: string;
      cloudShellUrl?: string;
      error?: string;
    }>;
  },

  saveGcpConnection: async (payload: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    billingDatasetId?: string;
    billingTableId?: string;
    enabledModules: string[];
  }) => {
    const res = await authFetch("/api/gcp/save-connection", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<{
      success: boolean;
      connection: {
        projectId: string;
        clientEmail: string;
        billingDatasetId: string | null;
        billingTableId: string | null;
        connectedAt: string;
      };
      error?: string;
    }>;
  },

  updateGcpBilling: async (billingDatasetId?: string, billingTableId?: string) => {
    const res = await authFetch("/api/gcp/update-billing", {
      method: "POST",
      body: JSON.stringify({ billingDatasetId, billingTableId }),
    });
    return res.json() as Promise<{
      success: boolean;
      connection: {
        billingDatasetId: string | null;
        billingTableId: string | null;
      };
      error?: string;
    }>;
  },

  disconnectGcp: async () => {
    const res = await authFetch("/api/gcp/credentials", {
      method: "DELETE",
    });
    return res.json() as Promise<{ success: boolean; error?: string }>;
  },

  // --- GitHub Settings ---
  getGithubStatus: async () => {
    const statusSchema = z.object({
      success: z.boolean(),
      connected: z.boolean(),
    });
    return authFetchJson("/api/github/status", statusSchema);
  },

  getGithubRepos: async () => {
    const repoSchema = z.object({
      id: z.union([z.string(), z.number()]).optional(),
      name: z.string(),
      fullName: z.string(),
      owner: z.string().optional(),
      cloneUrl: z.string().optional(),
      private: z.boolean().optional(),
      description: z.string().nullable().optional(),
      defaultBranch: z.string().optional(),
    });
    const reposSchema = z.object({
      success: z.boolean(),
      repos: z.array(repoSchema),
    });
    return authFetchJson("/api/github/repos", reposSchema);
  },

  disconnectGithub: async () => {
    return authFetchJson(
      "/api/github/disconnect",
      z.object({ success: z.boolean() }),
      { method: "DELETE" }
    );
  },

  // --- AI Keys Settings ---
  getAiKeysStatus: async (options?: { forceRefresh?: boolean }) => {
    const requestOptions = options?.forceRefresh
      ? { headers: { "x-rabbittwatch-cache-bypass": "true" } }
      : undefined;
    return authFetchJson("/api/ai-keys/status", undefined, requestOptions);
  },

  getAiKeysUsage: async (provider: "openai" | "anthropic" | "gemini", days: number, options?: { forceRefresh?: boolean }) => {
    const requestOptions = options?.forceRefresh
      ? { headers: { "x-rabbittwatch-cache-bypass": "true" } }
      : undefined;
    const url = provider === "openai"
      ? `/api/ai-keys/usage/openai?days=${days}`
      : `/api/ai-keys/usage/${provider}`;
    return authFetchJson(url, undefined, requestOptions);
  },

  getAiKeysLogs: async (logsDays: number) => {
    return authFetchJson(`/api/ai-keys/logs/openai?days=${logsDays}`);
  },

  getAiKeysPerKey: async (days: number) => {
    return authFetchJson(`/api/ai-keys/per-key/openai?days=${days}`);
  },

  saveAiKey: async (provider: "openai" | "anthropic" | "gemini" | "nvidia", apiKey: string) => {
    return authFetchJson("/api/ai-keys/save", undefined, {
      method: "POST",
      body: JSON.stringify({ provider, apiKey }),
    });
  },

  deleteAiKey: async (provider: "openai" | "anthropic" | "gemini" | "nvidia") => {
    return authFetchJson("/api/ai-keys/delete", undefined, {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
  },

  // --- Reports Settings ---
  getReportPreferences: async (options?: { forceRefresh?: boolean }) => {
    const requestOptions = options?.forceRefresh
      ? { headers: { "x-rabbittwatch-cache-bypass": "true" } }
      : undefined;
    const res = await authFetch("/api/usage-reports/preferences", requestOptions);
    return res.json() as Promise<AllPreferences>;
  },

  saveReportPreferences: async (type: ReportType, preferences: PreferenceSet) => {
    const res = await authFetch("/api/usage-reports/preferences", {
      method: "PUT",
      body: JSON.stringify({
        type,
        ...preferences,
        enabled: true,
      }),
    });
    return res.json() as Promise<{ success: boolean; preferences: PreferenceSet; error?: string }>;
  },

  sendTestReport: async (type: ReportType) => {
    const res = await authFetch("/api/usage-reports/test", {
      method: "POST",
      body: JSON.stringify({ type }),
    });
    return res.json() as Promise<{ success: boolean; recipient: string; nextSendAt?: string; error?: string }>;
  },
};
