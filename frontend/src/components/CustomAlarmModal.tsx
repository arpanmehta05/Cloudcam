"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authFetchJson } from "@/lib/auth-fetch";
import { useRegion } from "@/context/RegionContext";
import { AlarmModalContent } from "./CustomAlarmModal/AlarmModalContent";
import {
  ALARM_SERVICES,
  SERVICE_DIMENSION_MAP,
  SERVICE_NAMESPACE_MAP,
} from "./CustomAlarmModal/alarm-config";
import {
  emptyForm,
  getAlarmModalTitle,
  getDimensionKeyForProvider,
  getServiceKeyFromNamespace,
} from "./CustomAlarmModal/alarm-form";
import type {
  AlarmForm,
  AlarmResource,
  AlarmServiceInfo,
  CustomAlarmModalProps,
} from "./CustomAlarmModal/types";

export function CustomAlarmModal({
  isOpen,
  onClose,
  onSuccess,
  region,
  alarm,
  initialMetric,
}: CustomAlarmModalProps) {
  const { selectedProvider } = useRegion();
  const isEditing = !!alarm;
  const [form, setForm] = useState<AlarmForm>(() =>
    emptyForm(region, selectedProvider),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [alarmServices, setAlarmServices] = useState<AlarmServiceInfo[]>([]);
  const [resources, setResources] = useState<AlarmResource[]>([]);
  const [snsTopics, setSnsTopics] = useState<AlarmResource[]>([]);
  const [fetchingServices, setFetchingServices] = useState(false);
  const [fetchingResources, setFetchingResources] = useState(false);
  const [fetchingTopics, setFetchingTopics] = useState(false);

  const latestServicesRegionRef = useRef<string>("");
  const latestTopicsRegionRef = useRef<string>("");
  const latestResourcesParamsRef = useRef<{ service: string; region: string }>({
    service: "",
    region: "",
  });

  const availableMetrics = useMemo(() => {
    const svc = alarmServices.find((s) => s.key === form.service);
    return svc?.metrics || [];
  }, [alarmServices, form.service]);

  const selectedServiceInfo = useMemo(
    () => alarmServices.find((s) => s.key === form.service),
    [alarmServices, form.service],
  );

  const hasResourcesForService = selectedServiceInfo?.hasResources ?? false;

  const fetchServices = useCallback(
    async (regionVal: string) => {
      latestServicesRegionRef.current = regionVal;
      setFetchingServices(true);
      try {
        const data = await authFetchJson(
          `/api/${selectedProvider}/alarm-metadata/services?region=${regionVal}`,
        );
        if (latestServicesRegionRef.current !== regionVal) return;
        if (data.success) setAlarmServices(data.services || []);
      } catch (err: any) {
        console.warn("[CustomAlarmModal] Failed to fetch services:", err);
      } finally {
        if (latestServicesRegionRef.current === regionVal) {
          setFetchingServices(false);
        }
      }
    },
    [selectedProvider],
  );

  const fetchResourcesForService = useCallback(
    async (service: string, regionVal: string) => {
      if (!service || !regionVal) return;
      latestResourcesParamsRef.current = { service, region: regionVal };
      setFetchingResources(true);
      try {
        const data = await authFetchJson(
          `/api/${selectedProvider}/alarm-metadata/resources?service=${service}&region=${regionVal}`,
        );
        if (
          latestResourcesParamsRef.current.service !== service ||
          latestResourcesParamsRef.current.region !== regionVal
        ) {
          return;
        }
        setResources(data.success ? data.resources || [] : []);
      } catch (err: any) {
        console.warn("[CustomAlarmModal] Failed to fetch resources:", err);
        if (
          latestResourcesParamsRef.current.service === service &&
          latestResourcesParamsRef.current.region === regionVal
        ) {
          setResources([]);
        }
      } finally {
        if (
          latestResourcesParamsRef.current.service === service &&
          latestResourcesParamsRef.current.region === regionVal
        ) {
          setFetchingResources(false);
        }
      }
    },
    [selectedProvider],
  );

  const fetchSnsTopics = useCallback(
    async (regionVal: string) => {
      latestTopicsRegionRef.current = regionVal;
      setFetchingTopics(true);
      try {
        const data = await authFetchJson(
          `/api/${selectedProvider}/alarm-metadata/sns-topics?region=${regionVal}`,
        );
        if (latestTopicsRegionRef.current !== regionVal) return;
        if (data.success) setSnsTopics(data.topics || []);
      } catch (err: any) {
        console.warn(
          "[CustomAlarmModal] Failed to fetch SNS topics/Action Groups:",
          err,
        );
      } finally {
        if (latestTopicsRegionRef.current === regionVal) {
          setFetchingTopics(false);
        }
      }
    },
    [selectedProvider],
  );

  useEffect(() => {
    if (!isOpen) return;

    if (alarm) {
      const ns =
        alarm.namespace ||
        (selectedProvider === "azure"
          ? "Microsoft.Compute/virtualMachines"
          : selectedProvider === "gcp"
            ? "compute.googleapis.com/instance"
            : "AWS/EC2");
      const serviceKey = getServiceKeyFromNamespace(ns);
      const dimKey = getDimensionKeyForProvider(selectedProvider, serviceKey);
      const firstDim = alarm.dimensions?.[0] || {};

      let dimValue = firstDim.Value || "";
      if (serviceKey === "ecs") {
        const serviceNameDim = alarm.dimensions?.find(
          (d: any) => d.Name === "ServiceName",
        );
        const clusterNameDim = alarm.dimensions?.find(
          (d: any) => d.Name === "ClusterName",
        );
        if (serviceNameDim && clusterNameDim) {
          dimValue = `${clusterNameDim.Value}:${serviceNameDim.Value}`;
        } else if (serviceNameDim) {
          dimValue = serviceNameDim.Value;
        }
      }

      setForm({
        name: alarm.name || "",
        region:
          alarm.region ||
          (region === "all"
            ? selectedProvider === "azure"
              ? "eastus"
              : selectedProvider === "gcp"
                ? "us-central1"
                : "us-east-1"
            : region),
        service: serviceKey,
        namespace: ns,
        metric: alarm.metric || "",
        threshold: Number(alarm.threshold ?? 80),
        comparison: alarm.comparison || "GreaterThanThreshold",
        period: Number(alarm.period ?? 300),
        evaluationPeriods: Number(alarm.evaluationPeriods ?? 1),
        statistic: alarm.statistic || "Average",
        dimensionName: dimKey || firstDim.Name || "",
        dimensionValue: dimValue,
        snsTopicArn: alarm.actions?.[0] || "",
      });
    } else {
      const baseForm = emptyForm(region, selectedProvider);
      let serviceKey = "";
      let ns = "";
      let metric = "";

      if (initialMetric?.namespace) {
        serviceKey = getServiceKeyFromNamespace(initialMetric.namespace);
        ns = initialMetric.namespace;
        metric = initialMetric.metricName || "";
      }

      setForm({
        ...baseForm,
        name: initialMetric?.name ? `${initialMetric.name}-Alarm` : "",
        service: serviceKey,
        namespace: ns,
        metric,
      });
    }
    setError(null);
    setResources([]);
    setSnsTopics([]);
  }, [alarm, initialMetric, isOpen, region, selectedProvider]);

  useEffect(() => {
    if (!isOpen) return;
    fetchServices(form.region);
  }, [isOpen, form.region, fetchServices]);

  useEffect(() => {
    if (!isOpen) return;
    fetchSnsTopics(form.region);
  }, [isOpen, form.region, fetchSnsTopics]);

  const handleServiceChange = useCallback(
    (serviceKey: string) => {
      const svcInfo = alarmServices.find((s) => s.key === serviceKey);
      const ns = svcInfo
        ? svcInfo.namespace
        : SERVICE_NAMESPACE_MAP[serviceKey] || "";
      const dimKey = svcInfo
        ? svcInfo.dimensionKey
        : SERVICE_DIMENSION_MAP[serviceKey] || "";
      setForm((prev) => ({
        ...prev,
        service: serviceKey,
        namespace: ns,
        metric: "",
        dimensionName: dimKey,
        dimensionValue: "",
      }));
      setResources([]);
    },
    [alarmServices],
  );

  useEffect(() => {
    if (!form.service || !form.region) return;
    fetchResourcesForService(form.service, form.region);
  }, [form.service, form.region, fetchResourcesForService]);

  const autoAlarmName = useMemo(() => {
    const parts = [];
    if (form.service) {
      parts.push(
        (
          ALARM_SERVICES.find((s) => s.key === form.service)?.label ||
          form.service
        ).replace(/\s+/g, "-"),
      );
    }
    if (form.metric) parts.push(form.metric);
    if (form.dimensionValue) {
      const res = resources.find((r) => r.value === form.dimensionValue);
      const label = res?.label || form.dimensionValue;
      parts.push(label.split("/").pop() || label.replace(/\s+/g, "-"));
    }
    return parts.join("-").replace(/[^a-zA-Z0-9_-]/g, "");
  }, [form.service, form.metric, form.dimensionValue, resources]);

  const title = getAlarmModalTitle(isEditing, selectedProvider);
  const submitText = isEditing ? "Save Changes" : "Create Alarm";
  const loadingText = isEditing ? "Saving..." : "Creating...";
  const resolvedName = isEditing ? form.name : form.name || autoAlarmName;

  const canSubmit = useMemo(() => {
    return !!(
      resolvedName.trim() &&
      form.region.trim() &&
      form.service &&
      form.namespace.trim() &&
      form.metric.trim() &&
      form.dimensionValue.trim() &&
      form.snsTopicArn.trim() &&
      Number.isFinite(form.threshold) &&
      form.period > 0 &&
      form.evaluationPeriods > 0 &&
      hasResourcesForService
    );
  }, [form, hasResourcesForService, resolvedName]);

  if (!isOpen || !mounted) return null;

  const updateForm = (patch: Partial<AlarmForm>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const alarmName = (
      isEditing ? form.name : form.name || autoAlarmName
    ).trim();
    if (!alarmName) {
      setError("Alarm name is required");
      setLoading(false);
      return;
    }

    const dimensions =
      form.dimensionName.trim() && form.dimensionValue.trim()
        ? [
            {
              Name: form.dimensionName.trim(),
              Value: form.dimensionValue.trim(),
            },
          ]
        : [];
    const actions = form.snsTopicArn.trim() ? [form.snsTopicArn.trim()] : [];
    const payload = {
      region: form.region,
      alarm: {
        name: alarmName,
        metric: form.metric.trim(),
        namespace: form.namespace.trim(),
        threshold: Number(form.threshold),
        comparison: form.comparison,
        period: Number(form.period),
        evaluationPeriods: Number(form.evaluationPeriods),
        statistic: form.statistic,
        dimensions,
        actions,
        resourceId: form.dimensionValue.trim(),
      },
    };

    try {
      const url = isEditing
        ? `/api/${selectedProvider}/alarms/${encodeURIComponent(alarm.name)}`
        : `/api/${selectedProvider}/alarms`;
      const data = await authFetchJson(url, undefined, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Failed to save alarm");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save alarm");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto py-12"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-300 my-auto overflow-hidden flex flex-col max-h-[85vh] text-foreground relative"
      >
        <AlarmModalContent
          title={title}
          selectedProvider={selectedProvider}
          error={error}
          form={form}
          isEditing={isEditing}
          autoAlarmName={autoAlarmName}
          availableMetrics={availableMetrics}
          alarmServices={alarmServices}
          resources={resources}
          snsTopics={snsTopics}
          selectedServiceInfo={selectedServiceInfo}
          hasResourcesForService={hasResourcesForService}
          fetchingServices={fetchingServices}
          fetchingResources={fetchingResources}
          fetchingTopics={fetchingTopics}
          loading={loading}
          loadingText={loadingText}
          submitText={submitText}
          canSubmit={canSubmit}
          onClose={onClose}
          onSubmit={handleSubmit}
          onServiceChange={handleServiceChange}
          updateForm={updateForm}
        />
      </div>
    </div>,
    document.body,
  );
}
