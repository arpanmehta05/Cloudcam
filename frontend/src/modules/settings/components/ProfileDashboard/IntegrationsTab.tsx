"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { z } from "zod";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { authFetchJson } from "@/lib/auth-fetch";
import { RefreshCw, Brain, Cloud, Github } from "@/icons";
import { SettingRow, IntegrationsEnvelopeSchema } from "./shared";

interface IntegrationsTabProps {
  showConfirm: (
    title: string,
    description: string,
    type: "info" | "success" | "warning" | "danger" | "default",
    primaryLabel: string,
    onConfirm: () => void | Promise<void>
  ) => void;
  showErrorModal: (title: string, message: string) => void;
  closeConfirm: () => void;
}

export function IntegrationsTab({
  showConfirm,
  showErrorModal,
  closeConfirm,
}: IntegrationsTabProps) {
  const { user } = useAuth();
  const isReadOnlyUser =
    user?.permissionLevel === "viewer" || user?.permissionLevel === "operator";

  const [integrations, setIntegrations] = useState<any>(null);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [savingKeyProvider, setSavingKeyProvider] = useState<string | null>(null);
  const [aiKeyInputs, setAiKeyInputs] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
    gemini: "",
  });
  const [activeConnectKey, setActiveConnectKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!user) return;
    setLoadingIntegrations(true);
    try {
      const data = await authFetchJson(
        "/api/auth/integrations",
        IntegrationsEnvelopeSchema
      );
      setIntegrations(data.integrations);
    } catch (err: any) {
      setError(err.message || "Failed to load integrations status.");
    } finally {
      setLoadingIntegrations(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const saveAiKey = async (provider: string) => {
    const key = aiKeyInputs[provider];
    if (!key || !key.trim()) return;
    setError(null);
    setSavingKeyProvider(provider);
    try {
      await authFetchJson(
        "/api/auth/integrations/ai-key",
        z.object({
          success: z.boolean(),
        }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey: key.trim() }),
        }
      );
      setAiKeyInputs((prev) => ({ ...prev, [provider]: "" }));
      setActiveConnectKey(null);
      fetchIntegrations();
    } catch (err: any) {
      setError(err.message || `Failed to save ${provider} API key.`);
    } finally {
      setSavingKeyProvider(null);
    }
  };

  const disconnectAiKey = (provider: string) => {
    showConfirm(
      "Disconnect API Key",
      `Are you sure you want to disconnect your ${provider.toUpperCase()} API key?`,
      "warning",
      "Disconnect",
      async () => {
        setError(null);
        try {
          await authFetchJson(
            `/api/auth/integrations/ai-key/${provider}`,
            z.object({
              success: z.boolean(),
            }),
            {
              method: "DELETE",
            }
          );
          fetchIntegrations();
        } catch (err: any) {
          showErrorModal(
            "Disconnection Failed",
            err.message || `Failed to disconnect ${provider} API key.`
          );
        } finally {
          closeConfirm();
        }
      }
    );
  };

  const disconnectCloud = (provider: string) => {
    showConfirm(
      "Disconnect Cloud Connection",
      `Are you sure you want to disconnect your ${provider.toUpperCase()} Cloud credentials? This will stop resources and metrics synchronization immediately.`,
      "danger",
      "Disconnect Account",
      async () => {
        setError(null);
        try {
          await authFetchJson(
            `/api/auth/integrations/cloud/${provider}`,
            z.object({
              success: z.boolean(),
            }),
            {
              method: "DELETE",
            }
          );
          fetchIntegrations();
        } catch (err: any) {
          showErrorModal(
            "Disconnection Failed",
            err.message || `Failed to disconnect ${provider} credentials.`
          );
        } finally {
          closeConfirm();
        }
      }
    );
  };

  const disconnectGithub = () => {
    showConfirm(
      "Disconnect GitHub Integration",
      "Are you sure you want to disconnect your GitHub integration? Automatic repo scans and PR checks will be paused.",
      "warning",
      "Disconnect GitHub",
      async () => {
        setError(null);
        try {
          await authFetchJson(
            `/api/auth/integrations/github`,
            z.object({
              success: z.boolean(),
            }),
            {
              method: "DELETE",
            }
          );
          fetchIntegrations();
        } catch (err: any) {
          showErrorModal(
            "Disconnection Failed",
            err.message || "Failed to disconnect GitHub account."
          );
        } finally {
          closeConfirm();
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Cloud provider quick config rows */}
      <div className="grid gap-4 md:grid-cols-2">
        <SettingRow
          href={!isReadOnlyUser ? "/settings/aws" : undefined}
          icon={Cloud}
          title="AWS connection"
          body={
            user?.awsConnected
              ? "AWS workspace credentials are connected."
              : !isReadOnlyUser
                ? "Connect AWS from Settings."
                : "AWS credentials connected by admin."
          }
          status="live"
        />
        <SettingRow
          href={!isReadOnlyUser ? "/settings/azure" : undefined}
          icon={Cloud}
          title="Azure connection"
          body={
            user?.azureConnected
              ? "Azure workspace credentials are connected."
              : !isReadOnlyUser
                ? "Connect Azure from Settings."
                : "Azure credentials connected by admin."
          }
          status="live"
        />
        <SettingRow
          href={!isReadOnlyUser ? "/settings/gcp" : undefined}
          icon={Cloud}
          title="GCP connection"
          body={
            user?.gcpConnected
              ? "GCP workspace credentials are connected."
              : !isReadOnlyUser
                ? "Connect GCP from Settings."
                : "GCP credentials connected by admin."
          }
          status="live"
        />
        <SettingRow
          href={!isReadOnlyUser ? "/settings/github" : undefined}
          icon={Github}
          title="Git provider"
          body={
            user?.githubConnected
              ? "GitHub repository access is connected."
              : !isReadOnlyUser
                ? "Connect GitHub for repository-aware IaC workflows."
                : "GitHub connected by admin."
          }
          status="live"
        />
      </div>

      {/* Connected API Keys & Credentials detailed Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">
              Connected API Keys & Credentials
            </CardTitle>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Manage your AI provider API keys, cloud connections, and repository integrations.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 font-bold text-xs"
            onClick={fetchIntegrations}
            disabled={loadingIntegrations}
          >
            <RefreshCw className={`h-3 w-3 ${loadingIntegrations ? "animate-spin" : ""}`} />
            Sync Status
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-150 bg-red-50/20 p-3 text-xs font-semibold text-red-600 dark:border-red-950 dark:bg-red-950/25 dark:text-red-400">
              {error}
            </div>
          )}

          {loadingIntegrations && !integrations ? (
            <div className="text-center py-8 text-xs text-slate-400 font-semibold">
              Loading credentials details...
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-150 dark:border-slate-800 rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-900/30 border-b border-slate-150 dark:border-slate-800 font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="px-4 py-3">Integration</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Credential Info</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 font-semibold text-slate-700 dark:text-slate-200">
                    {/* AI Keys Section */}
                    <tr className="bg-slate-50/30 dark:bg-slate-900/10 font-bold">
                      <td colSpan={5} className="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        AI Observability Platforms
                      </td>
                    </tr>
                    {integrations &&
                      ["openai", "anthropic", "gemini"].map((provider) => {
                        const data = integrations.aiKeys[provider];
                        const isConnected = data.connected;
                        const isActive = activeConnectKey === provider;
                        const displayName =
                          provider === "openai"
                            ? "OpenAI GPT"
                            : provider === "anthropic"
                              ? "Anthropic Claude"
                              : "Google Gemini";

                        return (
                          <Fragment key={provider}>
                            <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                              <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Brain className="h-4 w-4 text-blue-500" />
                                {displayName}
                              </td>
                              <td className="px-4 py-3.5 text-slate-400">API Key</td>
                              <td className="px-4 py-3.5">
                                {isConnected ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold"
                                  >
                                    Connected
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-none text-[10px] font-bold"
                                  >
                                    Not connected
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {isConnected ? `•••• •••• ${data.lastFour}` : "No credentials connected"}
                              </td>
                              <td className="px-4 py-3.5 text-right space-x-2">
                                {isConnected ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => disconnectAiKey(provider)}
                                    className="h-8 px-2.5 text-[10px] font-bold border-red-150 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400"
                                  >
                                    Disconnect
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    onClick={() => setActiveConnectKey(isActive ? null : provider)}
                                    className="h-8 px-3 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    {isActive ? "Cancel" : "Connect"}
                                  </Button>
                                )}
                              </td>
                            </tr>
                            {isActive && (
                              <tr className="bg-slate-50/50 dark:bg-slate-900/20">
                                <td colSpan={5} className="px-4 py-3.5">
                                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between max-w-xl">
                                    <div className="space-y-1.5 flex-1">
                                      <Label
                                        htmlFor={`key-input-${provider}`}
                                        className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                                      >
                                        Paste your {displayName} API Key
                                      </Label>
                                      <Input
                                        id={`key-input-${provider}`}
                                        type="password"
                                        placeholder={
                                          provider === "openai"
                                            ? "sk-proj-..."
                                            : provider === "anthropic"
                                              ? "sk-ant-..."
                                              : "AIza..."
                                        }
                                        value={aiKeyInputs[provider]}
                                        onChange={(e) =>
                                          setAiKeyInputs((prev) => ({
                                            ...prev,
                                            [provider]: e.target.value,
                                          }))
                                        }
                                        className="h-9 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs rounded-lg animate-fade-in"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={() => saveAiKey(provider)}
                                      disabled={savingKeyProvider === provider || !aiKeyInputs[provider].trim()}
                                      className="h-9 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold rounded-lg"
                                    >
                                      {savingKeyProvider === provider ? "Validating..." : "Save Key"}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}

                    {/* Cloud Providers Section */}
                    <tr className="bg-slate-50/30 dark:bg-slate-900/10 font-bold">
                      <td colSpan={5} className="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Cloud Provider Accounts
                      </td>
                    </tr>
                    {integrations &&
                      ["aws", "azure", "gcp"].map((provider) => {
                        const data = integrations.cloud[provider];
                        const isConnected = data.connected;
                        const displayName =
                          provider === "aws"
                            ? "Amazon Web Services"
                            : provider === "azure"
                              ? "Microsoft Azure"
                              : "Google Cloud Platform";
                        const configUrl = `/settings/${provider}`;

                        return (
                          <tr key={provider} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                            <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <Cloud className="h-4 w-4 text-sky-500" />
                              {displayName}
                            </td>
                            <td className="px-4 py-3.5 text-slate-400 capitalize">{provider} Cloud</td>
                            <td className="px-4 py-3.5">
                              {isConnected ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold border-none ${
                                    data.status === "ok"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 animate-pulse"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  }`}
                                >
                                  {data.status === "ok" ? "Active" : "Setup Required"}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-none text-[10px] font-bold"
                                >
                                  Not connected
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                              {isConnected
                                ? provider === "aws"
                                  ? data.roleArn
                                  : provider === "azure"
                                    ? `Sub: ${data.subscriptionId}`
                                    : `Project: ${data.projectId}`
                                : "No cloud connected"}
                            </td>
                            <td className="px-4 py-3.5 text-right space-x-2">
                              <Link href={configUrl}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 px-2.5 text-[10px] font-bold border-slate-200 dark:border-slate-800"
                                >
                                  Configure
                                </Button>
                              </Link>
                              {isConnected && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => disconnectCloud(provider)}
                                  className="h-8 px-2.5 text-[10px] font-bold border-red-150 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400"
                                >
                                  Disconnect
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                    {/* Developer Tools Section */}
                    <tr className="bg-slate-50/30 dark:bg-slate-900/10 font-bold">
                      <td colSpan={5} className="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Developer Integrations
                      </td>
                    </tr>
                    {integrations && (
                      <tr className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Github className="h-4 w-4 text-slate-800 dark:text-slate-100" />
                          GitHub Integration
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">OAuth Access</td>
                        <td className="px-4 py-3.5">
                          {integrations.github.connected ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold"
                            >
                              Connected
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-none text-[10px] font-bold"
                            >
                              Not connected
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {integrations.github.connected
                            ? `Connected on ${new Intl.DateTimeFormat("en", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }).format(new Date(integrations.github.connectedAt))}`
                            : "Repository integration offline"}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <Link href="/settings/github">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 px-2.5 text-[10px] font-bold border-slate-200 dark:border-slate-800"
                            >
                              {integrations.github.connected ? "Manage" : "Connect"}
                            </Button>
                          </Link>
                          {integrations.github.connected && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={disconnectGithub}
                              className="h-8 px-2.5 text-[10px] font-bold border-red-150 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400"
                            >
                              Disconnect
                            </Button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
