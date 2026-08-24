"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/vps-logs.api";

export type Agent = {
  id: string;
  agentId: string;
  name: string;
  vpcId: string;
  environment: string;
  lastSeenAt: string | null;
  createdAt: string;
  collectionInterval?: number;
  enabledSources?: string[];
  status?: string;
};

export type TimelineBucket = {
  hour: string;
  error: number;
  warn: number;
  info: number;
  debug: number;
};

export type RecentLogRow = {
  id: string;
  agentId: string;
  source: string;
  service: string;
  level: string;
  message: string;
  timestamp: string;
};

export type SummaryResponse = {
  success: boolean;
  windowHours: number;
  alertPolicy?: {
    errorSignatureThreshold: number;
    windowMinutes: number;
    cooldownMinutes: number;
  };
  totals: { logs: number; errors: number; warnings: number };
  levels: { error: number; warn: number; info: number; debug: number };
  services: { service: string; count: number }[];
  topErrors: { signature: string; count: number; service: string; sample: string; lastSeenAt: string }[];
  timeline: TimelineBucket[];
  recent: RecentLogRow[];
};

export type AlarmRule = {
  id: string;
  name: string;
  type: "metric_threshold" | "log_volume";
  enabled: boolean;
  agentId: string;
  source: "all" | "docker" | "pm2" | "system" | "nginx" | "apache";
  service: string;
  level: "all" | "error" | "warn" | "info" | "debug";
  metric: "" | "cpuPercent" | "ramPercent" | "diskUsedPercent";
  comparator: "gte" | "gt" | "lte" | "lt";
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  severity: "critical" | "warning" | "info";
  messagePattern: string;
  lastTriggeredAt: string | null;
  lastValue: number | null;
};

export type TopError = {
  signature: string;
  count: number;
  service: string;
  sample: string;
  lastSeenAt: string;
};

export type HostMetricPoint = {
  timestamp: string;
  cpuPercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsedPercent: number;
  label: string;
};

function emptySummary(hours: number): SummaryResponse {
  return {
    success: true,
    windowHours: hours,
    totals: { logs: 0, errors: 0, warnings: 0 },
    levels: { error: 0, warn: 0, info: 0, debug: 0 },
    services: [],
    topErrors: [],
    timeline: [],
    recent: [],
  };
}

function rangeToHours(range: string): number {
  switch (range) {
    case "1h":
      return 1;
    case "6h":
      return 6;
    case "7d":
      return 24 * 7;
    default:
      return 24;
  }
}

export function useVpsLogs() {
  const [timeRange, setTimeRange] = useState("24h");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [alarmToDelete, setAlarmToDelete] = useState<AlarmRule | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<"All" | "docker" | "pm2" | "system" | "nginx" | "apache">("All");
  const [selectedLevel, setSelectedLevel] = useState<"All" | "error" | "warn" | "info" | "debug">("All");
  const [serviceFilter, setServiceFilter] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentVpcId, setNewAgentVpcId] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ agentId: string; ingestKey: string; apiBaseUrl: string } | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [selectedTopError, setSelectedTopError] = useState<TopError | null>(null);
  const [hostMetricRows, setHostMetricRows] = useState<RecentLogRow[]>([]);
  const [alarmRules, setAlarmRules] = useState<AlarmRule[]>([]);
  const [savingAlarm, setSavingAlarm] = useState(false);
  const [alarmType, setAlarmType] = useState<"metric_threshold" | "log_volume">("metric_threshold");
  const [alarmName, setAlarmName] = useState("High CPU");
  const [alarmMetric, setAlarmMetric] = useState<"cpuPercent" | "ramPercent" | "diskUsedPercent">("cpuPercent");
  const [alarmLevel, setAlarmLevel] = useState<"all" | "error" | "warn" | "info" | "debug">("error");
  const [alarmWindow, setAlarmWindow] = useState("15");
  const [alarmCooldown, setAlarmCooldown] = useState("30");
  const [alarmThreshold, setAlarmThreshold] = useState("80");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [policyErrorThreshold, setPolicyErrorThreshold] = useState("25");
  const [policyWindow, setPolicyWindow] = useState("15");
  const [policyCooldown, setPolicyCooldown] = useState("60");
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [savedPolicySuccess, setSavedPolicySuccess] = useState(false);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const fetchAll = useCallback(async (options?: { background?: boolean; forceRefresh?: boolean }) => {
    if (!options?.background) setLoading(true);
    try {
      const requestOptions = options?.forceRefresh
        ? { headers: { "x-rabbittwatch-cache-bypass": "true" } }
        : undefined;
      const hours = rangeToHours(timeRange);
      const query = new URLSearchParams({ hours: String(hours) });
      if (startDate) query.set("start", new Date(startDate).toISOString());
      if (endDate) query.set("end", new Date(endDate).toISOString());
      if (selectedAgent !== "all") query.set("agentId", selectedAgent);
      if (selectedSource !== "All") query.set("source", selectedSource);
      if (selectedLevel !== "All") query.set("level", selectedLevel);
      if (serviceFilter.trim()) query.set("service", serviceFilter.trim());
      if (logSearch.trim()) query.set("q", logSearch.trim());

      const metricsQuery = new URLSearchParams(query);
      metricsQuery.set("source", "system");
      metricsQuery.delete("level");
      metricsQuery.delete("service");
      metricsQuery.delete("q");

      const [agentsData, summaryData, metricsData, alarmsData] = await Promise.allSettled([
        api.fetchAgents(requestOptions),
        api.fetchSummary(query.toString(), requestOptions),
        api.fetchSummary(metricsQuery.toString(), requestOptions),
        api.fetchAlarms(requestOptions),
      ]);

      if (agentsData.status === "fulfilled" && agentsData.value.success) setAgents(agentsData.value.agents || []);
      if (summaryData.status === "fulfilled" && summaryData.value.success) setSummary(summaryData.value);
      else setSummary(emptySummary(hours));
      if (metricsData.status === "fulfilled" && metricsData.value.success) setHostMetricRows(metricsData.value.recent || []);
      else setHostMetricRows([]);
      if (alarmsData.status === "fulfilled" && alarmsData.value.success) setAlarmRules(alarmsData.value.alarms || []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Failed to fetch VPS log data:", error);
      setHostMetricRows([]);
    } finally {
      if (!options?.background) setLoading(false);
    }
  }, [selectedAgent, selectedSource, selectedLevel, serviceFilter, logSearch, timeRange, startDate, endDate]);

  const handleUpdateAgentConfig = async (agentId: string, updates: any) => {
    try {
      const data = await api.updateAgent(agentId, updates);
      if (data.success) {
        setIsSettingsOpen(false);
        fetchAll();
      }
    } catch (error) {
      console.error("handleUpdateAgentConfig error:", error);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (summary?.alertPolicy) {
      setPolicyErrorThreshold(String(summary.alertPolicy.errorSignatureThreshold ?? 25));
      setPolicyWindow(String(summary.alertPolicy.windowMinutes ?? 15));
      setPolicyCooldown(String(summary.alertPolicy.cooldownMinutes ?? 60));
    }
  }, [summary]);

  const levelsChartData = useMemo(() => {
    return [
      { level: "error", count: summary?.levels?.error || 0 },
      { level: "warn", count: summary?.levels?.warn || 0 },
      { level: "info", count: summary?.levels?.info || 0 },
      { level: "debug", count: summary?.levels?.debug || 0 },
    ];
  }, [summary]);

  const hostMetricsData = useMemo<HostMetricPoint[]>(() => {
    const rows = hostMetricRows || [];
    const points: HostMetricPoint[] = [];

    for (const row of rows) {
      if (row.source !== "system" || row.service !== "host-metrics") continue;
      try {
        const parsed = JSON.parse(row.message);
        const ts = parsed.timestamp || row.timestamp;
        const date = new Date(ts);
        if (Number.isNaN(date.getTime())) continue;

        points.push({
          timestamp: ts,
          cpuPercent: Number(parsed.cpuPercent || 0),
          ramUsedMb: Number(parsed.ramUsedMb || 0),
          ramTotalMb: Number(parsed.ramTotalMb || 0),
          diskUsedPercent: Number(parsed.diskUsedPercent || 0),
          label: date.toLocaleString([], {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      } catch {
        continue;
      }
    }

    return points
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-120);
  }, [hostMetricRows]);

  const currentMetrics = useMemo(() => {
    const last = hostMetricsData[hostMetricsData.length - 1];
    if (!last) {
      return {
        cpu: "-",
        ram: "-",
        disk: "-",
      };
    }

    const ramPercent = last.ramTotalMb > 0 ? (last.ramUsedMb / last.ramTotalMb) * 100 : 0;
    return {
      cpu: `${last.cpuPercent.toFixed(1)}%`,
      ram: `${ramPercent.toFixed(1)}%`,
      disk: `${last.diskUsedPercent.toFixed(1)}%`,
    };
  }, [hostMetricsData]);

  const timelineData = useMemo(() => {
    return (summary?.timeline || []).map((bucket) => {
      const date = new Date(bucket.hour);
      const label = Number.isNaN(date.getTime())
        ? bucket.hour
        : date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
      return { ...bucket, label };
    });
  }, [summary]);

  async function createAgent() {
    if (!newAgentName.trim()) return;
    setCreatingAgent(true);
    try {
      const data = await api.createAgent(newAgentName.trim(), newAgentVpcId.trim());
      if (data.success) {
        setCreatedCredentials({
          agentId: data.agent.agentId,
          ingestKey: data.ingestKey,
          apiBaseUrl: data.apiBaseUrl || window.location.origin,
        });
        setNewAgentName("");
        setNewAgentVpcId("");
        await fetchAll();
      }
    } catch (error) {
      console.error("Agent creation failed:", error);
    } finally {
      setCreatingAgent(false);
    }
  }

  async function handleSaveAlertPolicy() {
    setIsSavingPolicy(true);
    setSavedPolicySuccess(false);
    try {
      const data = await api.updateAlertPolicy({
        errorSignatureThreshold: Number(policyErrorThreshold),
        windowMinutes: Number(policyWindow),
        cooldownMinutes: Number(policyCooldown),
      });
      if (data.success) {
        setSummary((curr) => {
          if (!curr) return null;
          return {
            ...curr,
            alertPolicy: data.alertPolicy,
          };
        });
        setSavedPolicySuccess(true);
        setTimeout(() => setSavedPolicySuccess(false), 3000);
      }
    } catch (error: any) {
      console.error("Save alert policy failed:", error);
    } finally {
      setIsSavingPolicy(false);
    }
  }

  async function confirmDeleteAgent() {
    if (!agentToDelete) return;
    const agent = agentToDelete;
    setAgentToDelete(null);

    try {
      const res = await api.deleteAgent(agent.agentId);
      let data: any;
      try {
        data = await res.json();
      } catch (err) {
        // Ignore
      }

      if (selectedAgent === agent.agentId) {
        setSelectedAgent("all");
      }
      await fetchAll();
    } catch (error) {
      console.error("Delete agent failed:", error);
    }
  }

  async function clearRecentLogs() {
    const hours = rangeToHours(timeRange);
    setClearingLogs(true);
    try {
      const query = new URLSearchParams({ hours: String(hours) });
      if (selectedAgent !== "all") query.set("agentId", selectedAgent);
      if (selectedSource !== "All") query.set("source", selectedSource);

      await api.clearRecentLogs(query.toString());
      await fetchAll();
    } catch (error) {
      console.error("Clear recent logs failed:", error);
    } finally {
      setClearingLogs(false);
    }
  }

  async function createAlarmRule() {
    if (!alarmName.trim()) return;
    setSavingAlarm(true);
    try {
      const body = alarmType === "metric_threshold"
        ? {
            name: alarmName.trim(),
            type: alarmType,
            agentId: selectedAgent,
            metric: alarmMetric,
            threshold: Number(alarmThreshold),
            windowMinutes: Number(alarmWindow),
            cooldownMinutes: Number(alarmCooldown),
            severity: Number(alarmThreshold) >= 90 ? "critical" : "warning",
          }
        : {
            name: alarmName.trim(),
            type: alarmType,
            agentId: selectedAgent,
            source: selectedSource === "All" ? "all" : selectedSource,
            level: alarmLevel,
            threshold: Number(alarmThreshold),
            windowMinutes: Number(alarmWindow),
            cooldownMinutes: Number(alarmCooldown),
            severity: alarmLevel === "error" ? "critical" : "warning",
          };

      const data = await api.createAlarm(body);
      if (data.success) {
        setAlarmRules((current) => [data.alarm, ...current]);
        setAlarmName(alarmType === "metric_threshold" ? "High CPU" : "Error burst");
      }
    } catch (error) {
      console.error("Create alarm failed:", error);
    } finally {
      setSavingAlarm(false);
    }
  }

  async function toggleAlarmRule(rule: AlarmRule) {
    try {
      const data = await api.updateAlarm(rule.id, { enabled: !rule.enabled });
      if (data.success) {
        setAlarmRules((current) => current.map((item) => item.id === rule.id ? data.alarm : item));
      }
    } catch (error) {
      console.error("Toggle alarm failed:", error);
    }
  }

  async function confirmDeleteAlarm() {
    if (!alarmToDelete) return;
    const rule = alarmToDelete;
    setAlarmToDelete(null);

    try {
      const data = await api.deleteAlarm(rule.id);
      if (data.success) {
        setAlarmRules((current) => current.filter((item) => item.id !== rule.id));
      }
    } catch (error) {
      console.error("Delete alarm failed:", error);
    }
  }

  const agentOptions = useMemo(() => {
    const list = [{ value: "all", label: "All agents" }];
    agents.forEach((agent) => {
      list.push({
        value: agent.agentId,
        label: `${agent.name} ${agent.vpcId ? `(${agent.vpcId})` : ""}`
      });
    });
    return list;
  }, [agents]);

  const selectedAgentLabel = useMemo(() => {
    if (selectedAgent === "all") return "All agents";
    const agent = agents.find((item) => item.agentId === selectedAgent);
    if (!agent) return "Selected agent";
    return `${agent.name}${agent.vpcId ? ` (${agent.vpcId})` : ""}`;
  }, [agents, selectedAgent]);

  const selectedSourceLabel = useMemo(() => {
    if (selectedSource === "docker") return "Docker";
    if (selectedSource === "pm2") return "PM2";
    if (selectedSource === "system") return "System";
    if (selectedSource === "nginx") return "Nginx";
    if (selectedSource === "apache") return "Apache";
    return "All Sources";
  }, [selectedSource]);

  const hasCustomTimeFilter = Boolean(startDate || endDate);
  const activeLogFilterCount = useMemo(() => {
    return [
      selectedAgent !== "all",
      selectedSource !== "All",
      selectedLevel !== "All",
      serviceFilter.trim().length > 0,
      logSearch.trim().length > 0,
    ].filter(Boolean).length;
  }, [selectedAgent, selectedSource, selectedLevel, serviceFilter, logSearch]);

  return {
    timeRange,
    setTimeRange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    loading,
    setLoading,
    agents,
    isSettingsOpen,
    setIsSettingsOpen,
    editingAgent,
    setEditingAgent,
    agentToDelete,
    setAgentToDelete,
    alarmToDelete,
    setAlarmToDelete,
    selectedAgent,
    setSelectedAgent,
    selectedSource,
    setSelectedSource,
    selectedLevel,
    setSelectedLevel,
    serviceFilter,
    setServiceFilter,
    logSearch,
    setLogSearch,
    summary,
    lastUpdated,
    newAgentName,
    setNewAgentName,
    newAgentVpcId,
    setNewAgentVpcId,
    createdCredentials,
    setCreatedCredentials,
    creatingAgent,
    clearingLogs,
    showClearLogsConfirm,
    setShowClearLogsConfirm,
    selectedTopError,
    setSelectedTopError,
    alarmRules,
    savingAlarm,
    alarmType,
    setAlarmType,
    alarmName,
    setAlarmName,
    alarmMetric,
    setAlarmMetric,
    alarmLevel,
    setAlarmLevel,
    alarmWindow,
    setAlarmWindow,
    alarmCooldown,
    setAlarmCooldown,
    alarmThreshold,
    setAlarmThreshold,
    copiedId,
    policyErrorThreshold,
    setPolicyErrorThreshold,
    policyWindow,
    setPolicyWindow,
    policyCooldown,
    setPolicyCooldown,
    isSavingPolicy,
    savedPolicySuccess,
    handleCopy,
    fetchAll,
    handleUpdateAgentConfig,
    levelsChartData,
    hostMetricsData,
    currentMetrics,
    timelineData,
    createAgent,
    handleSaveAlertPolicy,
    confirmDeleteAgent,
    clearRecentLogs,
    createAlarmRule,
    toggleAlarmRule,
    confirmDeleteAlarm,
    agentOptions,
    selectedAgentLabel,
    selectedSourceLabel,
    hasCustomTimeFilter,
    activeLogFilterCount,
  };
}
