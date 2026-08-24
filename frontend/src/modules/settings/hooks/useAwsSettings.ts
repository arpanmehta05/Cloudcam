import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { settingsApi } from "../api/settings.api";
import { AwsConnectionMeta } from "../types";
import { useCloudCredentials } from "./useCloudCredentials";

const AWS_CONNECTED_STORAGE_KEY = "Rabbittize:aws:connected";

export function useAwsSettings() {
  const { user, refreshUser } = useAuth();
  const { saving: credSaving, error: credError, saveAwsCredentials, disconnectAws } = useCloudCredentials();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isAwsConnected, setIsAwsConnected] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AWS_CONNECTED_STORAGE_KEY) === "true";
  });
  const [connectionMeta, setConnectionMeta] = useState<AwsConnectionMeta>({
    roleArn: user?.awsCredentials?.roleArn || null,
    connectedAt: user?.awsCredentials?.connectedAt || null,
    enabledModules: [],
  });

  const [enableAiObservability, setEnableAiObservability] = useState(true);
  const [enableLogForwarding, setEnableLogForwarding] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const persistConnectionState = (connected: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(AWS_CONNECTED_STORAGE_KEY, connected ? "true" : "false");
    }
  };

  const refreshConnectionStatus = useCallback(async () => {
    setCheckingConnection(true);
    try {
      const data = await settingsApi.getAwsCredentials();
      const connected = !!data?.connected;
      setIsAwsConnected(connected);
      setConnectionMeta({
        roleArn: data?.roleArn || null,
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

  useEffect(() => {
    if (typeof user?.awsConnected === "boolean") {
      setIsAwsConnected(user.awsConnected);
      persistConnectionState(user.awsConnected);
      if (user.awsConnected) {
        setConnectionMeta({
          roleArn: user.awsCredentials?.roleArn || null,
          connectedAt: user.awsCredentials?.connectedAt || null,
        });
        setCurrentStep(2);
      }
    }
  }, [user]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsApi.setupAws(enableAiObservability, enableLogForwarding);
      if (data.success && data.quickCreateUrl) {
        window.open(data.quickCreateUrl, "_blank");
        setCurrentStep(1);
        setIsPolling(true);

        const pollInterval = setInterval(async () => {
          try {
            const credData = await settingsApi.getAwsCredentials();
            if (credData.connected && credData.roleArn) {
              clearInterval(pollInterval);
              setIsPolling(false);
              setIsAwsConnected(true);
              setConnectionMeta({
                roleArn: credData.roleArn || null,
                connectedAt: credData.connectedAt || null,
              });
              persistConnectionState(true);
              setCurrentStep(2);
              await refreshUser();
            }
          } catch { /* keep polling */ }
        }, 3000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setCurrentStep(prev => {
            if (prev === 1) {
              setIsPolling(false);
              setError("Connection timed out. Please check that the CloudFormation stack deployed successfully.");
              return 0;
            }
            return prev;
          });
        }, 600000);
      } else {
        throw new Error(data.error || "Failed to generate connection link");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectExisting = async (roleArn: string, externalId: string) => {
    return saveAwsCredentials(roleArn, externalId, refreshConnectionStatus);
  };

  const confirmDisconnect = async () => {
    return disconnectAws(setIsAwsConnected, setConnectionMeta, setCurrentStep, setIsConfirmOpen, refreshUser);
  };

  return {
    isAwsConnected,
    connectionMeta,
    currentStep,
    isLoading: isLoading || credSaving,
    isPolling,
    error: error || credError,
    checkingConnection,
    enableAiObservability,
    enableLogForwarding,
    isDisconnecting: credSaving,
    isConfirmOpen,
    setEnableAiObservability,
    setEnableLogForwarding,
    setCurrentStep,
    setIsConfirmOpen,
    refreshConnectionStatus,
    handleConnect,
    handleConnectExisting,
    confirmDisconnect,
  };
}
