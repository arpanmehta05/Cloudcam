import React, { useState, useEffect, useCallback } from "react";
import { useRegion } from "@/context/RegionContext";
import { SERVICE_REGISTRY } from "@/lib/services/registry";
import { DashboardHeader } from "@/components/DashboardHeader";
import { CustomAlarmModal } from "@/components/CustomAlarmModal";
import { DefaultAlarmsModal } from "@/components/DefaultAlarmsModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "@/icons";
import { useEntitlements, LockedFeatureScreen } from "@/modules/admin";

// Sub-panels
import { MetricsPanel } from "./MetricsPanel/MetricsPanel";
import { AlarmsPanel } from "./AlarmsPanel/AlarmsPanel";
import { LogsPanel } from "./LogsPanel/LogsPanel";
import { ResourcesPanel } from "./ResourcesPanel/ResourcesPanel";
import { SecurityPanel } from "./SecurityPanel/SecurityPanel";
import { BillingPanel } from "./BillingPanel/BillingPanel";

// Custom hooks
import { useMetrics } from "../hooks/useMetrics";
import { useAlarms } from "../hooks/useAlarms";
import { useLogs } from "../hooks/useLogs";
import { useResources } from "../hooks/useResources";
import { useBilling } from "../hooks/useBilling";

function getServiceResources(
  serviceId: string,
  inventory: any
): Array<{ id: string; name: string }> {
  if (!inventory) return [];
  switch (serviceId) {
    case "ec2":
      return (inventory.ec2 || []).map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
      }));
    case "lambda":
      return (inventory.lambda || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "rds":
      return (inventory.rds || []).map((r: any) => ({ id: r.id, name: r.id }));
    case "s3":
      return (inventory.s3 || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "ecs":
      return [
        ...new Set<string>((inventory.ecs || []).map((r: any) => r.cluster)),
      ].map((c) => ({ id: c, name: c }));
    case "eks":
      return (inventory.eks || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "amplify":
      return (inventory.amplify || []).map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
      }));
    case "dynamodb":
      return (inventory.dynamodb || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "sqs":
      return (inventory.sqs || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "snsqs":
      return (inventory.sqs || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "sns":
      return (inventory.sns || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "apigateway":
      return (inventory.apigateway || []).map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
      }));
    case "waf":
      return (inventory.waf || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "alb":
      return (inventory.alb || []).map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
      }));
    case "ebs":
      return (inventory.ebs || []).map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
      }));
    case "elasticache":
      return (inventory.elasticache || []).map((r: any) => ({
        id: r.id,
        name: r.id,
      }));
    case "redshift":
      return (inventory.redshift || []).map((r: any) => ({
        id: r.id,
        name: r.id,
      }));
    case "efs":
      return (inventory.efs || []).map((r: any) => ({ id: r.id, name: r.id }));
    case "kinesis":
      return (inventory.kinesis || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "eventbridge":
      return (inventory.eventbridge || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    case "stepfunctions":
      return (inventory.stepfunctions || []).map((r: any) => ({
        id: r.name,
        name: r.name,
      }));
    default:
      return [];
  }
}

const SERVICE_FEATURE_MAP: Record<string, { feature: string; label: string }> = {
  cost: { feature: "cost_explorer", label: "Cost Explorer" },
  billing: { feature: "cost_explorer", label: "Cost Explorer" },
  watchdog: { feature: "watchdog", label: "Watchdog" },
  simulations: { feature: "simulations", label: "Simulations" },
  vps_logs: { feature: "vps_logs", label: "VPS Logs" },
  ai_observability: { feature: "ai_observability", label: "AI Observability" },
};

function isEntitlementError(errStr: string | null): boolean {
  if (!errStr) return false;
  const lower = errStr.toLowerCase();
  return (
    lower.includes("upgrade to pro") ||
    lower.includes("upgrade to scale") ||
    lower.includes("not include this feature") ||
    lower.includes("not entitled")
  );
}

function getLockedFeatureInfo(serviceId: string, errorMsg: string | null): { feature: string; label: string } {
  if (SERVICE_FEATURE_MAP[serviceId]) {
    return SERVICE_FEATURE_MAP[serviceId];
  }
  const lower = (errorMsg || "").toLowerCase();
  if (lower.includes("spend") || lower.includes("cost") || lower.includes("billing")) {
    return { feature: "cost_explorer", label: "Cost Explorer" };
  }
  if (lower.includes("ai") || lower.includes("trace")) {
    return { feature: "ai_observability", label: "AI Observability" };
  }
  if (lower.includes("watchdog") || lower.includes("anomaly")) {
    return { feature: "watchdog", label: "Watchdog" };
  }
  if (lower.includes("vps") || lower.includes("log forwarding")) {
    return { feature: "vps_logs", label: "VPS Logs" };
  }
  if (lower.includes("simulation")) {
    return { feature: "simulations", label: "Simulations" };
  }
  return { feature: "cost_explorer", label: "Premium Feature" };
}

interface ServiceDashboardProps {
  serviceId: string;
}

export function ServiceDashboard({ serviceId }: ServiceDashboardProps) {
  const { selectedProvider, selectedRegion } = useRegion();
  const [range, setRange] = useState("24h");
  const [activeProvider, setActiveProvider] = useState<string>(selectedProvider || "all");
  const [error, setError] = useState<string | null>(null);

  const { entitlements, hasFeature, loading: entitlementsLoading } = useEntitlements();

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);
  const [alarmToDelete, setAlarmToDelete] = useState<{ region: string; alarmName: string } | null>(null);
  const [selectedMetricForAlarm, setSelectedMetricForAlarm] = useState<any>(null);
  const [editingAlarm, setEditingAlarm] = useState<any | null>(null);

  const serviceConfig = SERVICE_REGISTRY[serviceId];
  const hasLogGroup = !!serviceConfig?.logGroup;
  const isBillingService = serviceId === "cost" || serviceId === "billing";
  const isAlertsService = serviceId === "alerts";
  const isSecurityService = serviceId === "security" || serviceId === "waf";

  useEffect(() => {
    if (selectedProvider) {
      setActiveProvider(selectedProvider);
    }
  }, [selectedProvider]);

  // Hook calls
  const metricsHook = useMetrics(selectedProvider, serviceId, range, selectedRegion);
  const alarmsHook = useAlarms(selectedProvider, selectedRegion);
  const resourcesHook = useResources(selectedProvider, selectedRegion, serviceId);
  const logsHook = useLogs(selectedProvider, serviceId, range, selectedRegion, hasLogGroup);
  const billingHook = useBilling(activeProvider, range);

  // Sync internal error states
  const consolidatedError =
    error ||
    (isBillingService ? billingHook.error : null) ||
    (isAlertsService ? alarmsHook.error : null) ||
    (!isBillingService && !isAlertsService ? (metricsHook.error || resourcesHook.error) : null);

  const consolidatedLoading =
    isBillingService
      ? billingHook.loading
      : isAlertsService
        ? alarmsHook.loading
        : metricsHook.loading || resourcesHook.loading;

  const handleRefresh = useCallback(
    async (options?: { forceRefresh?: boolean; background?: boolean }) => {
      setError(null);
      if (isBillingService) {
        billingHook.refetch(options);
      } else if (isAlertsService) {
        alarmsHook.refetch(options);
      } else {
        metricsHook.refetch(options);
        resourcesHook.refetch(options);
        if (hasLogGroup) {
          logsHook.refetch(logsHook.selectedResource, options);
        }
      }
    },
    [isBillingService, isAlertsService, hasLogGroup, billingHook, alarmsHook, metricsHook, resourcesHook, logsHook]
  );

  const confirmDeleteAlarm = async () => {
    if (!alarmToDelete) return;
    const { region, alarmName } = alarmToDelete;
    setAlarmToDelete(null);
    const success = await alarmsHook.deleteAlarm(alarmName, region);
    if (!success) {
      setError(`Failed to delete alarm "${alarmName}"`);
    }
  };

  const openCreateAlarmModal = () => {
    setEditingAlarm(null);
    setSelectedMetricForAlarm(null);
    setIsCreateModalOpen(true);
  };

  const openEditAlarmModal = (alarm: any) => {
    setSelectedMetricForAlarm(null);
    setEditingAlarm(alarm);
    setIsCreateModalOpen(true);
  };

  const serviceResources = getServiceResources(serviceId, resourcesHook.inventory);

  if (!serviceConfig) {
    return (
      <div className="p-8 text-center text-red-500">
        Service {serviceId} not found in registry.
      </div>
    );
  }

  const requiredFeature = SERVICE_FEATURE_MAP[serviceId];
  const isLockedByPlan = requiredFeature && !entitlementsLoading && !hasFeature(requiredFeature.feature);
  const isLockedByError = isEntitlementError(consolidatedError);

  if (isLockedByPlan || isLockedByError) {
    const featureInfo = getLockedFeatureInfo(serviceId, consolidatedError);
    return (
      <div className="py-2">
        <LockedFeatureScreen
          feature={featureInfo.feature}
          featureLabel={featureInfo.label}
          entitlements={entitlements}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-transparent animate-in fade-in duration-700">
      <DashboardHeader
        timeRange={range}
        onTimeRangeChange={setRange}
        onRefresh={() => handleRefresh({ forceRefresh: true })}
        onAutoRefresh={() => handleRefresh({ forceRefresh: false, background: true })}
        isLoading={consolidatedLoading}
        lastUpdated={metricsHook.metrics?.lastUpdated || ""}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 bg-transparent px-1 py-1">
        {consolidatedError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">{consolidatedError}</span>
          </div>
        )}

        {isBillingService && (
          <BillingPanel
            billing={billingHook.billing}
            loading={billingHook.loading}
            range={range}
            activeProvider={activeProvider}
            setActiveProvider={setActiveProvider}
          />
        )}

        {isAlertsService && (
          <AlarmsPanel
            alarms={alarmsHook.alarms}
            loading={alarmsHook.loading}
            processingAlarms={alarmsHook.processingAlarms}
            selectedProvider={selectedProvider}
            onToggleAlarm={alarmsHook.toggleAlarm}
            onEditAlarm={openEditAlarmModal}
            onDeleteAlarm={(region, name) => setAlarmToDelete({ region, alarmName: name })}
            onCreateAlarm={openCreateAlarmModal}
            onProvisionBestPractices={() => setIsDefaultModalOpen(true)}
          />
        )}

        {isSecurityService && (
          <SecurityPanel
            serviceId={serviceId}
            metrics={metricsHook.metrics}
            loading={metricsHook.loading}
            range={range}
            diagnostics={metricsHook.diagnostics}
            onCreateAlarm={(m) => {
              setEditingAlarm(null);
              setSelectedMetricForAlarm(m);
              setIsCreateModalOpen(true);
            }}
            inventory={resourcesHook.inventory}
            insights={resourcesHook.insights}
            insightsLoading={resourcesHook.insightsLoading}
            serviceConfig={serviceConfig}
            s3Buckets={metricsHook.s3Buckets}
            s3Summary={metricsHook.s3Summary}
          />
        )}

        {!isBillingService && !isAlertsService && !isSecurityService && (
          <div className="space-y-6">
            <MetricsPanel
              serviceConfig={serviceConfig}
              metrics={metricsHook.metrics}
              loading={metricsHook.loading}
              range={range}
              diagnostics={metricsHook.diagnostics}
              onCreateAlarm={(m) => {
                setEditingAlarm(null);
                setSelectedMetricForAlarm(m);
                setIsCreateModalOpen(true);
              }}
            />

            <ResourcesPanel
              serviceId={serviceId}
              inventory={resourcesHook.inventory}
              insights={resourcesHook.insights}
              loading={resourcesHook.loading}
              insightsLoading={resourcesHook.insightsLoading}
              serviceConfig={serviceConfig}
              s3Buckets={metricsHook.s3Buckets}
              s3Summary={metricsHook.s3Summary}
            />

            {hasLogGroup && (
              <LogsPanel
                logs={logsHook.logs}
                loading={logsHook.loading}
                hasLogs={logsHook.hasLogs}
                selectedResource={logsHook.selectedResource}
                onResourceChange={(resource) => {
                  logsHook.setSelectedResource(resource);
                  logsHook.refetch(resource);
                }}
                serviceResources={serviceResources}
                selectedProvider={selectedProvider}
              />
            )}
          </div>
        )}
      </main>

      <CustomAlarmModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingAlarm(null);
        }}
        onSuccess={() => handleRefresh()}
        region={selectedRegion}
        alarm={editingAlarm}
        initialMetric={selectedMetricForAlarm}
      />

      <DefaultAlarmsModal
        isOpen={isDefaultModalOpen}
        onClose={() => setIsDefaultModalOpen(false)}
        onSuccess={() => handleRefresh()}
      />

      <Dialog
        open={!!alarmToDelete}
        onOpenChange={(open) => !open && setAlarmToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Alarm</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the alarm &quot;
              {alarmToDelete?.alarmName}&quot;? This action will permanently
              delete the alarm from the cloud provider.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setAlarmToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAlarm}>
              Delete Alarm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export { ServiceDashboard as default };
