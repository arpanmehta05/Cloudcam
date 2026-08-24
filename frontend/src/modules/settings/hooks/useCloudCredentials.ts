import { useState } from "react";
import { settingsApi } from "../api/settings.api";

export function useCloudCredentials() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveAwsCredentials = async (
    roleArn: string,
    externalId: string,
    refreshConnectionStatus: () => Promise<void>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const data = await settingsApi.saveAwsRole(roleArn, externalId);
      if (data.success) {
        await refreshConnectionStatus();
        return true;
      } else {
        setError(data.error || "Failed to save credentials");
        return false;
      }
    } catch {
      setError("Network error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const disconnectAws = async (
    setIsAwsConnected: (v: boolean) => void,
    setConnectionMeta: (v: any) => void,
    setCurrentStep: (v: number) => void,
    setIsConfirmOpen: (v: boolean) => void,
    refreshUser: () => Promise<void>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const data = await settingsApi.disconnectAws();
      if (data.success) {
        setIsAwsConnected(false);
        setConnectionMeta({ roleArn: null, connectedAt: null });
        setCurrentStep(0);
        setIsConfirmOpen(false);
        await refreshUser();
        return true;
      } else {
        setError(data.error || "Failed to disconnect AWS account");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAzureCredentials = async (
    payload: any,
    setIsAzureConnected: (v: boolean) => void,
    setConnectionMeta: (v: any) => void,
    setCurrentStep: (v: number) => void,
    refreshUser: () => Promise<void>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const data = await settingsApi.saveAzureConnection(payload);
      if (data.success) {
        setIsAzureConnected(true);
        setConnectionMeta({
          tenantId: data.connection.tenantId,
          subscriptionId: data.connection.subscriptionId,
          billingAccountId: data.connection.billingAccountId || null,
          clientId: data.connection.clientId || null,
          connectedAt: data.connection.connectedAt,
        });
        setCurrentStep(2);
        await refreshUser();
        return true;
      } else {
        setError(data.error || "Validation failed. Check your credentials.");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const disconnectAzure = async (
    resetConnectionUi: () => void,
    refreshUser: () => Promise<void>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const data = await settingsApi.disconnectAzure();
      if (!data.success) {
        throw new Error(data.error || "Failed to disconnect Azure connection");
      }
      resetConnectionUi();
      await refreshUser();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to disconnect Azure connection");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveGcpCredentials = async (
    payload: any,
    setIsGcpConnected: (v: boolean) => void,
    setConnectionMeta: (v: any) => void,
    setCurrentStep: (v: number) => void,
    refreshUser: () => Promise<void>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const data = await settingsApi.saveGcpConnection(payload);
      if (data.success) {
        setIsGcpConnected(true);
        setConnectionMeta({
          projectId: data.connection.projectId,
          clientEmail: data.connection.clientEmail,
          billingDatasetId: data.connection.billingDatasetId,
          billingTableId: data.connection.billingTableId,
          connectedAt: data.connection.connectedAt,
        });
        setCurrentStep(2);
        await refreshUser();
        return true;
      } else {
        setError(data.error || "Validation failed. Check your credentials.");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateGcpBilling = async (
    datasetInput: string,
    tableInput: string,
    setConnectionMeta: (v: any) => void,
    setIsEditingBilling: (v: boolean) => void,
    refreshUser: () => Promise<void>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const data = await settingsApi.updateGcpBilling(
        datasetInput.trim() || undefined,
        tableInput.trim() || undefined
      );
      if (data.success) {
        setConnectionMeta((prev: any) => ({
          ...prev,
          billingDatasetId: data.connection.billingDatasetId,
          billingTableId: data.connection.billingTableId,
        }));
        setIsEditingBilling(false);
        await refreshUser();
        return true;
      } else {
        setError(data.error || "Failed to update billing settings");
        return false;
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const disconnectGcp = async (
    resetConnectionUi: () => void,
    refreshUser: () => Promise<void>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const data = await settingsApi.disconnectGcp();
      if (!data.success) {
        throw new Error(data.error || "Failed to disconnect GCP connection");
      }
      resetConnectionUi();
      await refreshUser();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to disconnect GCP connection");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    error,
    setError,
    saveAwsCredentials,
    disconnectAws,
    saveAzureCredentials,
    disconnectAzure,
    saveGcpCredentials,
    updateGcpBilling,
    disconnectGcp,
  };
}
