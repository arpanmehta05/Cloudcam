import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { resizeMigrationApi } from "../api/resize-migration.api";
import {
  MigrationJob,
  MigrationTask,
  SourceServer,
  TargetSize,
} from "../types";
import {
  getActiveRegions,
  getChecklistItems as buildChecklistItems,
  getConsoleLogs,
  getFilteredJobs,
  getFilteredSources,
  getFilteredTerminalLogs,
  getGeneratedSshCommand,
  getRegionLabel,
  getRunningServers,
  getTargetHost,
  getTaskSummary,
} from "./resizeMigrationDerived";
import {
  buildAccessConfigurationBody,
  buildClassificationConfirmationBody,
  buildCreateJobPlanBody,
} from "./resizeMigrationPayloads";

export function useResizeMigration(initialJobId: string | null = null) {
  const router = useRouter();
  
  // List & Selection
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId);
  const [activeJob, setActiveJob] = useState<MigrationJob | null>(null);
  const [customSshUsername, setCustomSshUsername] = useState("");
  const [customSshKeyName, setCustomSshKeyName] = useState("");
  const [activeTasks, setActiveTasks] = useState<MigrationTask[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingJob, setIsLoadingJob] = useState(false);

  // Form states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [provider, setProvider] = useState<"aws" | "azure" | "gcp">("aws");
  const [region, setRegion] = useState("ap-south-1");
  const [sources, setSources] = useState<SourceServer[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [targetSizes, setTargetSizes] = useState<TargetSize[]>([]);
  const [isLoadingTargetSizes, setIsLoadingTargetSizes] = useState(false);
  const [selectedTargetType, setSelectedTargetType] = useState("");
  const [cutoverMode, setCutoverMode] = useState<"manual" | "elastic_ip" | "dns">("manual");

  // DNS Config states
  const [dnsHostedZoneId, setDnsHostedZoneId] = useState("");
  const [dnsZoneName, setDnsZoneName] = useState("");
  const [dnsResourceGroupName, setDnsResourceGroupName] = useState("");
  const [dnsDomainName, setDnsDomainName] = useState("");
  const [dnsRecordType, setDnsRecordType] = useState("A");
  const [dnsTtl, setDnsTtl] = useState(300);

  // Scheduling states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");

  // AI Explanation states
  const [explainingTasks, setExplainingTasks] = useState<Record<string, boolean>>({});

  // Resuming state
  const [isResuming, setIsResuming] = useState(false);

  // Delete confirmation modal
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // List filtering state
  const [filterTab, setFilterTab] = useState<"all" | "active" | "archived">("all");

  // Access Config Form
  const [accessMode, setAccessMode] = useState<"cloud_only" | "deep_inspection">("cloud_only");
  const [accessMethod, setAccessMethod] = useState<"ssh" | "ssm">("ssh");
  const [sshUsername, setSshUsername] = useState("ubuntu");
  const [sshPort, setSshPort] = useState(22);
  const [sshKey, setSshKey] = useState("");
  const [isConfiguringAccess, setIsConfiguringAccess] = useState(false);
  const [stopSourceAfterCutover, setStopSourceAfterCutover] = useState(false);
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [selectedLogLevel, setSelectedLogLevel] = useState<"all" | "info" | "warning" | "error">("all");
  const [classificationOverride, setClassificationOverride] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Dynamic polling trigger
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize custom ssh username and key when active job changes
  useEffect(() => {
    if (activeJob) {
      const defaultUser =
        activeJob.metadata?.targetAccessProfile?.suggestedUsername ||
        activeJob.metadata?.sourceAccessProfile?.suggestedUsername ||
        activeJob.accessConfig?.username ||
        (activeJob.provider === "aws" ? "ubuntu" : "azureuser");
      const defaultKey =
        activeJob.metadata?.targetAccessProfile?.keyPairName ||
        activeJob.metadata?.sourceAccessProfile?.keyPairName ||
        "keypair";
      setCustomSshUsername(defaultUser);
      setCustomSshKeyName(defaultKey);
    }
  }, [activeJob]);

  // Synchronize stopSourceAfterCutover with activeJob metadata
  useEffect(() => {
    if (activeJob) {
      setStopSourceAfterCutover(
        Boolean(
          activeJob.metadata?.classification?.confirmed
            ? activeJob.metadata?.stopSourceAfterCutover
            : false
        ) || Boolean(activeJob.metadata?.stopSourceAfterCutover)
      );
    }
  }, [activeJob]);

  useEffect(() => {
    if (!activeJob) return;

    setAccessMode(activeJob.accessMode || "cloud_only");
    setAccessMethod(activeJob.accessConfig?.method === "ssm" ? "ssm" : "ssh");
    setSshUsername(
      activeJob.accessConfig?.username ||
        activeJob.metadata?.targetAccessProfile?.suggestedUsername ||
        activeJob.metadata?.sourceAccessProfile?.suggestedUsername ||
        "ubuntu"
    );
    setSshPort(activeJob.accessConfig?.port || 22);
    setClassificationOverride("");
  }, [activeJob]);

  // Dynamic region filtering based on running source servers
  const runningServers = getRunningServers(sources);
  const activeRegions = getActiveRegions(runningServers);

  // Auto-select first active region when the provider or active regions list changes
  useEffect(() => {
    if (isCreateOpen) {
      if (activeRegions.length > 0) {
        if (!activeRegions.includes(region)) {
          setRegion(activeRegions[0]);
        }
      } else {
        setRegion("");
      }
    }
  }, [activeRegions, isCreateOpen]);

  const filteredSources = getFilteredSources(sources, region);

  const fetchJobs = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const data = await resizeMigrationApi.getJobs();
      if (data.success) {
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to load resize jobs:", err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const fetchJobDetails = useCallback(
    async (jobId: string, background = false) => {
      if (!background) setIsLoadingJob(true);
      try {
        const data = await resizeMigrationApi.getJobDetails(jobId);
        if (data.success) {
          setActiveJob(data.job);
          setActiveTasks(data.tasks || []);
        }
      } catch (err) {
        console.error("Failed to load job details:", err);
      } finally {
        if (!background) setIsLoadingJob(false);
      }
    },
    []
  );

  // Fetch sources on dialog open or provider change
  useEffect(() => {
    if (!isCreateOpen) return;

    let active = true;
    async function fetchSources() {
      setIsLoadingSources(true);
      setSources([]); // Clear previous sources immediately to avoid stale provider data
      try {
        const data = await resizeMigrationApi.getSources(provider);
        if (active) {
          if (data.success) {
            setSources(data.sources || []);
          } else {
            setSources([]);
          }
        }
      } catch (err) {
        console.error("Failed to load source instances:", err);
        if (active) setSources([]);
      } finally {
        if (active) setIsLoadingSources(false);
      }
    }
    fetchSources();
    setSelectedSourceId("");
    setTargetSizes([]);
    setSelectedTargetType("");

    return () => {
      active = false;
    };
  }, [isCreateOpen, provider]);

  // Fetch target types when source server is selected
  useEffect(() => {
    if (!selectedSourceId || !isCreateOpen) return;

    // Prevent fetching if provider and sourceId are mismatched
    if (provider === "aws" && !selectedSourceId.startsWith("i-")) return;
    if (provider === "azure" && !selectedSourceId.startsWith("/")) return;
    if (
      provider === "gcp" &&
      (selectedSourceId.startsWith("i-") || selectedSourceId.startsWith("/"))
    )
      return;

    let active = true;
    async function fetchTargetSizes() {
      setIsLoadingTargetSizes(true);
      try {
        const data = await resizeMigrationApi.getTargetSizes(
          provider,
          region,
          selectedSourceId
        );
        if (active) {
          if (data.success) {
            setTargetSizes(data.targetSizes || []);
          } else {
            setTargetSizes([]);
          }
        }
      } catch (err) {
        console.error("Failed to load target sizes:", err);
        if (active) setTargetSizes([]);
      } finally {
        if (active) setIsLoadingTargetSizes(false);
      }
    }
    fetchTargetSizes();
    setSelectedTargetType("");

    return () => {
      active = false;
    };
  }, [selectedSourceId, isCreateOpen, provider, region]);

  // Load initial jobs
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!initialJobId) {
      setActiveJobId(null);
      setActiveJob(null);
      setActiveTasks([]);
      return;
    }

    setActiveJobId(initialJobId);
    fetchJobDetails(initialJobId);
  }, [initialJobId, fetchJobDetails]);

  // Setup background polling when an active job is open and running
  useEffect(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    if (activeJobId && activeJob) {
      const isStateTransitioning = [
        "preflight",
        "snapshotting",
        "launching_target",
        "validating",
        "cutover",
        "rolled_back",
      ].includes(activeJob.status);

      if (isStateTransitioning) {
        pollingIntervalRef.current = setInterval(() => {
          fetchJobDetails(activeJobId, true);
        }, 3000);
      }
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [activeJobId, activeJob, fetchJobDetails]);

  const handleCreateJob = async () => {
    if (!selectedSourceId || !selectedTargetType) return;
    const source = sources.find((s) => s.id === selectedSourceId);

    try {
      const body = buildCreateJobPlanBody({
        provider,
        region,
        source,
        selectedSourceId,
        selectedTargetType,
        cutoverMode,
        accessMode,
        accessMethod,
        sshUsername,
        sshPort,
        sshKey,
        isScheduled,
        scheduledTime,
        dnsHostedZoneId,
        dnsZoneName,
        dnsResourceGroupName,
        dnsDomainName,
        dnsRecordType,
        dnsTtl,
      });

      const data = await resizeMigrationApi.createJobPlan(body);
      if (data.success) {
        setIsCreateOpen(false);
        fetchJobs();
        router.push(`/resize-migration/${data.job._id}`);
      }
    } catch (err) {
      console.error("Failed to create migration plan:", err);
    }
  };

  const handleResumeJob = async () => {
    if (!activeJobId) return;
    setIsResuming(true);
    try {
      const data = await resizeMigrationApi.resumeJob(activeJobId);
      if (data.success) {
        setActiveJob(data.job);
        setActiveTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Failed to resume job:", err);
    } finally {
      setIsResuming(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!activeJobId) return;
    try {
      const blob = await resizeMigrationApi.downloadReport(activeJobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `migration-audit-report-${activeJobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download report:", err);
      alert("Failed to download PDF report.");
    }
  };

  const handleCopyText = async (value: string, isSsh = false) => {
    try {
      await navigator.clipboard.writeText(value);
      if (isSsh) {
        setCopiedSsh(true);
        setTimeout(() => setCopiedSsh(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleOpenJob = useCallback(
    (job: MigrationJob) => {
      setActiveJobId(job._id);
      setActiveJob(job);
      router.push(`/resize-migration/${job._id}`);
    },
    [router]
  );

  const handleDeleteJob = (jobId: string) => {
    setDeleteConfirmJobId(jobId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmJobId) return;
    setIsDeleting(true);
    try {
      const data = await resizeMigrationApi.deleteJob(deleteConfirmJobId);
      if (!data.success) {
        throw new Error(data.error || "Failed to delete resize migration job");
      }

      if (activeJobId === deleteConfirmJobId) {
        setActiveJobId(null);
        setActiveJob(null);
        setActiveTasks([]);
        router.push("/resize-migration");
      }

      setDeleteConfirmJobId(null);
      await fetchJobs();
    } catch (err) {
      console.error("Failed to delete resize migration job:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExplainTask = async (taskKey: string) => {
    if (!activeJobId) return;
    setExplainingTasks((prev) => ({ ...prev, [taskKey]: true }));
    try {
      const data = await resizeMigrationApi.explainTask(activeJobId, taskKey);
      if (data.success && data.explanation) {
        const explanation = data.explanation;
        setActiveTasks((prevTasks) =>
          prevTasks.map((t) => {
            if (t.key === taskKey) {
              return { ...t, aiExplanation: explanation };
            }
            return t;
          })
        );
      } else {
        setActiveTasks((prevTasks) =>
          prevTasks.map((t) => {
            if (t.key === taskKey) {
              return {
                ...t,
                aiExplanation: {
                  explanation: "Failed to load explanation.",
                  likelyCause: data.error || "Unknown error occurred.",
                  remediationSteps: [
                    "Please retry explanation or verify API credentials.",
                  ],
                  alternativeFallback: "Check the raw system execution logs.",
                },
              };
            }
            return t;
          })
        );
      }
    } catch (err: any) {
      console.error("AI Explain call failed:", err);
      setActiveTasks((prevTasks) =>
        prevTasks.map((t) => {
          if (t.key === taskKey) {
            return {
              ...t,
              aiExplanation: {
                explanation: "Failed to connect to backend service.",
                likelyCause: err.message || "Network request error.",
                remediationSteps: [
                  "Ensure backend server is running and accessible.",
                ],
                alternativeFallback: "Check console log or network status.",
              },
            };
          }
          return t;
        })
      );
    } finally {
      setExplainingTasks((prev) => ({ ...prev, [taskKey]: false }));
    }
  };

  const handleConfigureAccess = async () => {
    if (!activeJobId) return;
    setIsConfiguringAccess(true);
    try {
      const body = buildAccessConfigurationBody({
        accessMode,
        accessMethod,
        sshUsername,
        sshPort,
        sshKey,
      });

      const data = await resizeMigrationApi.configureAccess(activeJobId, body);
      if (data.success) {
        await fetchJobDetails(activeJobId);
        setSshKey(""); // clear key for security
      }
    } catch (err) {
      console.error("Failed to save access configuration:", err);
    } finally {
      setIsConfiguringAccess(false);
    }
  };

  const handleConfirmClassification = async (bucket: string) => {
    if (!activeJobId || !activeJob) return;
    try {
      const body = buildClassificationConfirmationBody(activeJob, bucket);
      const data = await resizeMigrationApi.confirmClassification(activeJobId, body);
      if (data.success) {
        await fetchJobDetails(activeJobId);
      }
    } catch (err) {
      console.error("Failed to confirm workload classification:", err);
    }
  };

  const handleTransitionStatus = async (nextStatus: string, metadata?: any) => {
    if (!activeJobId) return;
    try {
      const data = await resizeMigrationApi.transitionStatus(
        activeJobId,
        nextStatus,
        metadata
      );
      if (data.success) {
        await fetchJobDetails(activeJobId);
      }
    } catch (err) {
      console.error(`Failed to transition to status ${nextStatus}:`, err);
    }
  };

  const filteredJobs = getFilteredJobs(jobs, filterTab);
  const {
    completedTaskCount,
    failedTaskCount,
    runningTask,
    pendingTaskCount,
    progressPercent,
    expandedTask,
    latestFailedTask,
  } = getTaskSummary(activeTasks, expandedTaskId);
  const targetHost = getTargetHost(activeJob, activeTasks);
  const targetHostLabel = targetHost || "Awaiting target IP";

  const sourcePlatform =
    activeJob?.metadata?.sourceAccessProfile?.platformDetails ||
    activeJob?.metadata?.sourceAccessProfile?.imageName ||
    "Pending";

  const classificationInfo = activeJob?.metadata?.classification || null;

  const consoleLogs = getConsoleLogs(activeJob, activeTasks);
  const filteredTerminalLogs = getFilteredTerminalLogs(
    consoleLogs,
    selectedLogLevel
  );
  const generatedSshCommand = getGeneratedSshCommand(
    activeJob,
    targetHost,
    customSshUsername,
    customSshKeyName
  );
  const getChecklistItems = () =>
    buildChecklistItems(activeJob, activeTasks, targetHost);

  return {
    // State
    jobs,
    activeJobId,
    activeJob,
    customSshUsername,
    setCustomSshUsername,
    customSshKeyName,
    setCustomSshKeyName,
    activeTasks,
    isLoadingList,
    isLoadingJob,
    isCreateOpen,
    setIsCreateOpen,
    provider,
    setProvider,
    region,
    setRegion,
    sources,
    isLoadingSources,
    selectedSourceId,
    setSelectedSourceId,
    targetSizes,
    isLoadingTargetSizes,
    selectedTargetType,
    setSelectedTargetType,
    cutoverMode,
    setCutoverMode,
    dnsHostedZoneId,
    setDnsHostedZoneId,
    dnsZoneName,
    setDnsZoneName,
    dnsResourceGroupName,
    setDnsResourceGroupName,
    dnsDomainName,
    setDnsDomainName,
    dnsRecordType,
    setDnsRecordType,
    dnsTtl,
    setDnsTtl,
    isScheduled,
    setIsScheduled,
    scheduledTime,
    setScheduledTime,
    explainingTasks,
    isResuming,
    deleteConfirmJobId,
    setDeleteConfirmJobId,
    isDeleting,
    filterTab,
    setFilterTab,
    accessMode,
    setAccessMode,
    accessMethod,
    setAccessMethod,
    sshUsername,
    setSshUsername,
    sshPort,
    setSshPort,
    sshKey,
    setSshKey,
    isConfiguringAccess,
    stopSourceAfterCutover,
    setStopSourceAfterCutover,
    copiedSsh,
    selectedLogLevel,
    setSelectedLogLevel,
    classificationOverride,
    setClassificationOverride,
    expandedTaskId,
    setExpandedTaskId,

    // Derived values
    runningServers,
    activeRegions,
    filteredSources,
    filteredJobs,
    completedTaskCount,
    failedTaskCount,
    runningTask,
    pendingTaskCount,
    progressPercent,
    expandedTask,
    latestFailedTask,
    targetHost,
    targetHostLabel,
    sourcePlatform,
    classificationInfo,
    consoleLogs,
    filteredTerminalLogs,
    generatedSshCommand,

    // Actions
    fetchJobs,
    fetchJobDetails,
    handleCreateJob,
    handleResumeJob,
    handleDownloadReport,
    handleCopyText,
    handleOpenJob,
    handleDeleteJob,
    handleConfirmDelete,
    handleExplainTask,
    handleConfigureAccess,
    handleConfirmClassification,
    handleTransitionStatus,
    getChecklistItems,
    getRegionLabel,
  };
}
