import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { settingsApi } from "../api/settings.api";
import { AzureConnectionMeta } from "../types";
import { CLOUD_MODULES, CloudModule } from "@/lib/cloud/setup";
import { useCloudCredentials } from "./useCloudCredentials";

const AZURE_CONNECTED_STORAGE_KEY = "Rabbittize:azure:connected";

export function useAzureSettings() {
  const { user, refreshUser } = useAuth();
  const { saving: credSaving, error: credError, saveAzureCredentials, disconnectAzure } = useCloudCredentials();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isAzureConnected, setIsAzureConnected] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AZURE_CONNECTED_STORAGE_KEY) === "true";
  });

  const [connectionMeta, setConnectionMeta] = useState<AzureConnectionMeta>({
    tenantId: null,
    subscriptionId: null,
    billingAccountId: null,
    clientId: null,
    connectedAt: null,
  });

  const [modules, setModules] = useState<CloudModule[]>(CLOUD_MODULES);
  const [setupDetails, setSetupDetails] = useState<{
    cloudShellScript: string;
    terraformTemplate: string;
    webhookUrl: string;
    webhookSecret: string;
  } | null>(null);

  const [provisionMethod, setProvisionMethod] = useState<"oneclick" | "cli" | "tf" | "manual">("oneclick");
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedTf, setCopiedTf] = useState(false);

  // One-Click state
  const [oneClickTenantId, setOneClickTenantId] = useState("");
  const [oneClickSubId, setOneClickSubId] = useState("");
  const [oneClickPrincipalId, setOneClickPrincipalId] = useState("");
  const [oneClickEnableLogAnalytics, setOneClickEnableLogAnalytics] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [deployUrl, setDeployUrl] = useState("");
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Manual Credentials state
  const [manualType, setManualType] = useState<"sp" | "principal">("sp");
  const [manualTenantId, setManualTenantId] = useState("");
  const [manualSubId, setManualSubId] = useState("");
  const [manualBillingAccountId, setManualBillingAccountId] = useState("");
  const [manualClientId, setManualClientId] = useState("");
  const [manualClientSecret, setManualClientSecret] = useState("");
  const [manualPrincipalId, setManualPrincipalId] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const persistConnectionState = (connected: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(AZURE_CONNECTED_STORAGE_KEY, connected ? "true" : "false");
    }
  };

  const resetConnectionUi = () => {
    setIsAzureConnected(false);
    setConnectionMeta({
      tenantId: null,
      subscriptionId: null,
      billingAccountId: null,
      clientId: null,
      connectedAt: null,
    });
    persistConnectionState(false);
    setCurrentStep(0);
  };

  const startConnectionPolling = useCallback(() => {
    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const credData = await settingsApi.getAzureCredentials();
        if (credData.connected) {
          clearInterval(pollInterval);
          setIsPolling(false);
          setIsAzureConnected(true);
          setConnectionMeta({
            tenantId: credData.tenantId,
            subscriptionId: credData.subscriptionId,
            billingAccountId: credData.billingAccountId || null,
            clientId: credData.clientId || null,
            connectedAt: credData.connectedAt,
          });
          persistConnectionState(true);
          setCurrentStep(2);
          await refreshUser();
        }
      } catch { /* continue polling */ }
    }, 3000);

    setTimeout(() => {
      clearInterval(pollInterval);
      setIsPolling(false);
    }, 600000);
  }, [refreshUser]);

  const refreshConnectionStatus = useCallback(async () => {
    setCheckingConnection(true);
    try {
      const data = await settingsApi.getAzureCredentials();
      const connected = !!data?.connected;
      setIsAzureConnected(connected);
      setConnectionMeta({
        tenantId: data?.tenantId || null,
        subscriptionId: data?.subscriptionId || null,
        billingAccountId: data?.billingAccountId || null,
        clientId: data?.clientId || null,
        connectedAt: data?.connectedAt || null,
      });
      persistConnectionState(connected);
      if (connected) {
        setCurrentStep(2);
      }
    } catch {
      // Keep cached state
    } finally {
      setCheckingConnection(false);
    }
  }, []);

  useEffect(() => {
    refreshConnectionStatus();
  }, [refreshConnectionStatus]);

  const handleGenerateSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsApi.setupAzure(modules.filter(m => m.checked).map(m => m.id));
      if (data.success) {
        setSetupDetails({
          cloudShellScript: data.cloudShellScript || "",
          terraformTemplate: data.terraformTemplate || "",
          webhookUrl: data.webhookUrl || "",
          webhookSecret: data.webhookSecret || "",
        });
        setCurrentStep(1);
        startConnectionPolling();
      } else {
        throw new Error(data.error || "Failed to generate Azure configuration");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError(null);
    try {
      const data = await settingsApi.getAzureTemplate();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "azure-onboarding.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Failed to download template: " + err.message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleGenerateDeployUrl = async () => {
    if (!oneClickTenantId.trim() || !oneClickSubId.trim() || !oneClickPrincipalId.trim()) {
      setError("Tenant ID, Subscription ID, and Principal ID are required.");
      return;
    }
    setGeneratingLink(true);
    setError(null);
    try {
      const data = await settingsApi.setupAzure(
        modules.filter(m => m.checked).map(m => m.id),
        {
          tenantId: oneClickTenantId.trim(),
          subscriptionId: oneClickSubId.trim(),
          principalId: oneClickPrincipalId.trim(),
          enableLogAnalytics: oneClickEnableLogAnalytics,
        }
      );
      if (data.success && data.deployUrl) {
        setDeployUrl(data.deployUrl);
        startConnectionPolling();
      } else {
        throw new Error(data.error || "Failed to generate Deploy to Azure link");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSaveManual = async () => {
    const isSp = manualType === "sp";
    if (isSp) {
      if (!manualTenantId.trim() || !manualSubId.trim() || !manualClientId.trim() || !manualClientSecret.trim()) {
        setManualError("All fields are required for Service Principal manual setup.");
        return;
      }
    } else {
      if (!manualTenantId.trim() || !manualSubId.trim() || !manualPrincipalId.trim()) {
        setManualError("Tenant ID, Subscription ID, and Principal ID are required.");
        return;
      }
    }

    setManualError(null);
    const payload: any = {
      tenantId: manualTenantId.trim(),
      subscriptionId: manualSubId.trim(),
      billingAccountId: manualBillingAccountId.trim() || undefined,
      enabledModules: modules.filter(m => m.checked).map(m => m.id),
    };
    if (isSp) {
      payload.clientId = manualClientId.trim();
      payload.clientSecret = manualClientSecret.trim();
    } else {
      payload.principalId = manualPrincipalId.trim();
    }

    const success = await saveAzureCredentials(
      payload,
      setIsAzureConnected,
      setConnectionMeta,
      setCurrentStep,
      refreshUser
    );
    if (!success) {
      setManualError(credError);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Azure connection?")) return;
    await disconnectAzure(resetConnectionUi, refreshUser);
  };

  const toggleModule = (id: string) => {
    setModules(prev =>
      prev.map(m => (m.id === id && !m.disabled ? { ...m, checked: !m.checked } : m))
    );
  };

  const copyToClipboard = (text: string, type: "cli" | "tf") => {
    navigator.clipboard.writeText(text);
    if (type === "cli") {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } else {
      setCopiedTf(true);
      setTimeout(() => setCopiedTf(false), 2000);
    }
  };

  return {
    isAzureConnected,
    connectionMeta,
    currentStep,
    isLoading,
    isPolling,
    error: error || credError,
    checkingConnection,
    isDisconnecting: credSaving,
    modules,
    setupDetails,
    provisionMethod,
    copiedCli,
    copiedTf,
    oneClickTenantId,
    oneClickSubId,
    oneClickPrincipalId,
    oneClickEnableLogAnalytics,
    generatingLink,
    deployUrl,
    downloadingTemplate,
    manualType,
    manualTenantId,
    manualSubId,
    manualBillingAccountId,
    manualClientId,
    manualClientSecret,
    manualPrincipalId,
    manualSaving: credSaving,
    manualError: manualError || credError,
    setProvisionMethod,
    setOneClickTenantId,
    setOneClickSubId,
    setOneClickPrincipalId,
    setOneClickEnableLogAnalytics,
    setManualType,
    setManualTenantId,
    setManualSubId,
    setManualBillingAccountId,
    setManualClientId,
    setManualClientSecret,
    setManualPrincipalId,
    setManualError,
    toggleModule,
    handleGenerateSetup,
    handleDownloadTemplate,
    handleGenerateDeployUrl,
    handleSaveManual,
    handleDisconnect,
    copyToClipboard,
    refreshConnectionStatus,
    setDeployUrl,
    setCurrentStep,
  };
}
