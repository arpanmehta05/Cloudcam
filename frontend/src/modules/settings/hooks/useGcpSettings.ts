import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { settingsApi } from "../api/settings.api";
import { GcpConnectionMeta } from "../types";
import { CLOUD_MODULES, CloudModule } from "@/lib/cloud/setup";
import { useCloudCredentials } from "./useCloudCredentials";

const GCP_CONNECTED_STORAGE_KEY = "Rabbittize:gcp:connected";

export function useGcpSettings() {
  const { user, refreshUser } = useAuth();
  const {
    saving: credSaving,
    error: credError,
    saveGcpCredentials,
    updateGcpBilling,
    disconnectGcp
  } = useCloudCredentials();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isGcpConnected, setIsGcpConnected] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(GCP_CONNECTED_STORAGE_KEY) === "true";
  });

  const [connectionMeta, setConnectionMeta] = useState<GcpConnectionMeta>({
    projectId: null,
    clientEmail: null,
    billingDatasetId: null,
    billingTableId: null,
    connectedAt: null,
  });

  const [modules, setModules] = useState<CloudModule[]>(CLOUD_MODULES);
  const [setupDetails, setSetupDetails] = useState<{
    cloudShellScript: string;
    terraformTemplate: string;
    webhookUrl: string;
    cloudShellUrl?: string;
  } | null>(null);

  const [provisionMethod, setProvisionMethod] = useState<"cli" | "tf" | "manual">("cli");
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedTf, setCopiedTf] = useState(false);

  // Manual configuration state
  const [manualProjectId, setManualProjectId] = useState("");
  const [manualClientEmail, setManualClientEmail] = useState("");
  const [manualPrivateKey, setManualPrivateKey] = useState("");
  const [manualBillingDatasetId, setManualBillingDatasetId] = useState("");
  const [manualBillingTableId, setManualBillingTableId] = useState("");
  const [jsonPaste, setJsonPaste] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  // Edit Billing state
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [billingDatasetInput, setBillingDatasetInput] = useState("");
  const [billingTableInput, setBillingTableInput] = useState("");
  const [billingError, setBillingError] = useState<string | null>(null);

  const persistConnectionState = (connected: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(GCP_CONNECTED_STORAGE_KEY, connected ? "true" : "false");
    }
  };

  const resetConnectionUi = () => {
    setIsGcpConnected(false);
    setConnectionMeta({
      projectId: null,
      clientEmail: null,
      billingDatasetId: null,
      billingTableId: null,
      connectedAt: null,
    });
    persistConnectionState(false);
    setCurrentStep(0);
  };

  const startConnectionPolling = useCallback(() => {
    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const credData = await settingsApi.getGcpCredentials();
        if (credData.connected) {
          clearInterval(pollInterval);
          setIsPolling(false);
          setIsGcpConnected(true);
          setConnectionMeta({
            projectId: credData.projectId,
            clientEmail: credData.clientEmail,
            billingDatasetId: credData.billingDatasetId,
            billingTableId: credData.billingTableId,
            connectedAt: credData.connectedAt,
          });
          if (credData.billingDatasetId) setBillingDatasetInput(credData.billingDatasetId);
          if (credData.billingTableId) setBillingTableInput(credData.billingTableId);
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
      const data = await settingsApi.getGcpCredentials();
      const connected = !!data?.connected;
      setIsGcpConnected(connected);
      setConnectionMeta({
        projectId: data?.projectId || null,
        clientEmail: data?.clientEmail || null,
        billingDatasetId: data?.billingDatasetId || null,
        billingTableId: data?.billingTableId || null,
        connectedAt: data?.connectedAt || null,
      });
      if (data?.billingDatasetId) setBillingDatasetInput(data.billingDatasetId);
      if (data?.billingTableId) setBillingTableInput(data.billingTableId);
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
      const data = await settingsApi.setupGcp(modules.filter(m => m.checked).map(m => m.id));
      if (data.success) {
        setSetupDetails({
          cloudShellScript: data.cloudShellScript,
          terraformTemplate: data.terraformTemplate,
          webhookUrl: data.webhookUrl,
          cloudShellUrl: data.cloudShellUrl,
        });
        setCurrentStep(1);
        startConnectionPolling();
      } else {
        throw new Error(data.error || "Failed to generate GCP configuration");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJsonPasteChange = (val: string) => {
    setJsonPaste(val);
    setManualError(null);
    if (!val.trim()) return;
    try {
      const parsed = JSON.parse(val);
      if (parsed.project_id) setManualProjectId(parsed.project_id);
      if (parsed.client_email) setManualClientEmail(parsed.client_email);
      if (parsed.private_key) setManualPrivateKey(parsed.private_key);
    } catch (err) {
      // Wait for valid JSON
    }
  };

  const handleSaveManual = async () => {
    if (!manualProjectId.trim() || !manualClientEmail.trim() || !manualPrivateKey.trim()) {
      setManualError("Project ID, Client Email, and Private Key are required.");
      return;
    }
    setManualError(null);
    const success = await saveGcpCredentials(
      {
        projectId: manualProjectId.trim(),
        clientEmail: manualClientEmail.trim(),
        privateKey: manualPrivateKey.trim(),
        billingDatasetId: manualBillingDatasetId.trim() || undefined,
        billingTableId: manualBillingTableId.trim() || undefined,
        enabledModules: modules.filter(m => m.checked).map(m => m.id),
      },
      setIsGcpConnected,
      setConnectionMeta,
      setCurrentStep,
      refreshUser
    );
    if (!success) {
      setManualError(credError);
    }
  };

  const handleUpdateBilling = async () => {
    setBillingError(null);
    const success = await updateGcpBilling(
      billingDatasetInput,
      billingTableInput,
      setConnectionMeta,
      setIsEditingBilling,
      refreshUser
    );
    if (!success) {
      setBillingError(credError);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect GCP connection?")) return;
    await disconnectGcp(resetConnectionUi, refreshUser);
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
    isGcpConnected,
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
    manualProjectId,
    manualClientEmail,
    manualPrivateKey,
    manualBillingDatasetId,
    manualBillingTableId,
    jsonPaste,
    manualSaving: credSaving,
    manualError: manualError || credError,
    isEditingBilling,
    billingDatasetInput,
    billingTableInput,
    savingBilling: credSaving,
    billingError: billingError || credError,
    setProvisionMethod,
    setManualProjectId,
    setManualClientEmail,
    setManualPrivateKey,
    setManualBillingDatasetId,
    setManualBillingTableId,
    setIsEditingBilling,
    setBillingDatasetInput,
    setBillingTableInput,
    setManualError,
    toggleModule,
    handleGenerateSetup,
    handleJsonPasteChange,
    handleSaveManual,
    handleUpdateBilling,
    handleDisconnect,
    copyToClipboard,
    refreshConnectionStatus,
    setCurrentStep,
    setBillingError,
  };
}
