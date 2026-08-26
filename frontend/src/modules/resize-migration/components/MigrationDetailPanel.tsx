"use client";

import React, { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useResizeMigration } from "../hooks/useResizeMigration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Loader2, Play, RefreshCw, ShieldAlert, ShieldCheck } from "@/icons";

// Sub-components
import { OverviewGrid } from "./MigrationDetailPanel/OverviewGrid";
import { MigrationDetailsTab } from "./MigrationDetailPanel/MigrationDetailsTab";
import { TaskTimeline } from "./MigrationDetailPanel/TaskTimeline";
import { LiveConsoleLogs } from "./MigrationDetailPanel/LiveConsoleLogs";
import { WorkChecklist } from "./MigrationDetailPanel/WorkChecklist";
import { TargetConnectionCard } from "./MigrationDetailPanel/TargetConnectionCard";
import { CutoverControls } from "./MigrationDetailPanel/CutoverControls";

const statusTones: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft: { label: "Draft", bg: "bg-slate-50 dark:bg-slate-900/30", text: "text-slate-655 dark:text-slate-400", border: "border-slate-200 dark:border-slate-800" },
  preflight: { label: "Preflight", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", border: "border-blue-150 dark:border-blue-900/35" },
  snapshotting: { label: "Snapshotting", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", border: "border-amber-150 dark:border-amber-900/35" },
  launching_target: { label: "Launching Target", bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600 dark:text-violet-400", border: "border-violet-150 dark:border-violet-900/35" },
  validating: { label: "Validating", bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-155 dark:border-cyan-900/35" },
  awaiting_cutover: { label: "Awaiting Cutover", bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600 dark:text-orange-400", border: "border-orange-150 dark:border-orange-900/35" },
  cutover: { label: "Cutover Active", bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-150 dark:border-indigo-900/35" },
  completed: { label: "Completed", bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-150 dark:border-emerald-900/35" },
  failed: { label: "Failed", bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-600 dark:text-red-400", border: "border-red-150 dark:border-red-900/35" },
  rolled_back: { label: "Rolled Back", bg: "bg-pink-50 dark:bg-pink-900/20", text: "text-pink-600 dark:text-pink-400", border: "border-pink-150 dark:border-pink-900/35" },
};

type MigrationDetailPanelProps = ReturnType<typeof useResizeMigration>;

export function MigrationDetailPanel(props: MigrationDetailPanelProps) {
  const {
    activeJob, activeTasks, isLoadingJob, explainingTasks, isResuming, accessMode, setAccessMode,
    accessMethod, setAccessMethod, sshUsername, setSshUsername, sshPort, setSshPort, sshKey, setSshKey,
    isConfiguringAccess, stopSourceAfterCutover, copiedSsh, selectedLogLevel, setSelectedLogLevel,
    classificationOverride, setClassificationOverride, expandedTaskId, setExpandedTaskId, completedTaskCount,
    runningTask, pendingTaskCount, progressPercent, targetHost, targetHostLabel, filteredTerminalLogs,
    generatedSshCommand, handleResumeJob, handleDownloadReport, handleCopyText, handleExplainTask,
    handleConfigureAccess, handleConfirmClassification, handleTransitionStatus, getChecklistItems,
    customSshUsername, setCustomSshUsername, customSshKeyName, setCustomSshKeyName
  } = props;

  const router = useRouter();
  const terminalScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [filteredTerminalLogs]);

  if (isLoadingJob || !activeJob) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/20">
        <div className="flex items-center gap-3 text-sm font-extrabold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#2563eb]" /> Loading migration details...
        </div>
      </div>
    );
  }

  const renderClassificationBanner = () => {
    if (!activeJob?.metadata?.classification) return null;
    const info = activeJob.metadata.classification;
    return (
      <Card className="h-full border-[#dfe3ea] bg-slate-50/50 shadow-sm dark:border-[#334155] dark:bg-[#0f172a]/20 overflow-hidden">
        <CardContent className="p-4 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">Server Classification</span>
              <Badge className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]">{info.classification}</Badge>
              <Badge variant="outline" className="border-[#cbd5e1] text-[#475569] dark:border-[#475569] dark:text-[#cbd5e1]">Confidence: {info.confidence}</Badge>
              {info.confirmed && <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Confirmed</Badge>}
            </div>
            <p className="text-xs font-semibold text-[#475569] dark:text-[#94a3b8] line-clamp-2">Signals: {info.signals.join(", ") || "No signals recorded."}</p>
          </div>
          {!info.confirmed && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleConfirmClassification(info.classification)} className="font-extrabold text-[12px] h-9 border-[#cbd5e1]">Confirm Class</Button>
              <Select value={classificationOverride} onValueChange={setClassificationOverride}>
                <SelectTrigger className="h-9 w-[180px] text-[12px] font-extrabold border-[#cbd5e1]"><SelectValue placeholder="Override Bucket" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Self-contained server">Self-contained</SelectItem>
                  <SelectItem value="Partially external server">Partially external</SelectItem>
                  <SelectItem value="Custom full-system server">Custom full-system</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!classificationOverride} onClick={() => handleConfirmClassification(classificationOverride)} className="h-9 bg-[#2563eb] px-3 text-[12px] font-extrabold text-white hover:bg-blue-700 disabled:opacity-50">Confirm Override</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-[min(1800px,calc(100vw-2rem))] space-y-4 select-text">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/resize-migration")} className="h-9 w-9 rounded-lg border-slate-205 shadow-sm"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-extrabold text-[#020617] dark:text-white flex items-center gap-2">Migration Details <span className="text-xs font-mono text-[#94a3b8]">#{activeJob._id.slice(-6)}</span></h1>
            <p className="text-xs font-semibold text-[#64748b]">Clone of {activeJob.sourceServerName || activeJob.sourceServerId} to {activeJob.targetServerType} ({activeJob.region})</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeJob.status === "draft" && <Button onClick={() => handleTransitionStatus("preflight")} className="bg-[#2563eb] text-white hover:bg-blue-700 font-extrabold text-[13px] h-9 shadow-lg shadow-blue-500/20"><Play className="h-4 w-4 mr-2" /> Start Preflight</Button>}
          {activeJob.status === "preflight" && (
            <Button onClick={() => handleTransitionStatus("snapshotting")} disabled={activeTasks.find((t) => t.key === "preflight")?.status === "running"} className="bg-[#2563eb] text-white hover:bg-blue-700 font-extrabold text-[13px] h-9 shadow-lg shadow-blue-500/20">
              {activeTasks.find((t) => t.key === "preflight")?.status === "running" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying Preflight...</> : <><Play className="h-4 w-4 mr-2" /> Start Migration (Clone)</>}
            </Button>
          )}
          {activeJob.status === "failed" && (
            <>
              <Button onClick={handleResumeJob} disabled={isResuming} className="bg-[#2563eb] text-white hover:bg-blue-700 font-extrabold text-[13px] h-9 shadow-lg shadow-blue-500/20">{isResuming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resuming...</> : <><Play className="h-4 w-4 mr-2" /> Resume Migration</>}</Button>
              <Button onClick={() => handleTransitionStatus("preflight")} className="bg-slate-900 text-white hover:bg-black font-extrabold text-[13px] h-9 shadow-sm"><RefreshCw className="h-4 w-4 mr-2" /> Restart Preflight</Button>
            </>
          )}
          <Badge className={`${statusTones[activeJob.status]?.bg} ${statusTones[activeJob.status]?.text} ${statusTones[activeJob.status]?.border} border px-3 py-1.5 text-xs font-extrabold rounded-md`}>{statusTones[activeJob.status]?.label || activeJob.status}</Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MigrationDetailsTab activeJob={activeJob} />
        {activeJob.accessMode === "cloud_only" ? (
          <div className="h-full rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/35 dark:bg-amber-950/15"><div className="flex gap-3"><ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" /><div className="space-y-1"><h4 className="text-sm font-extrabold text-amber-800 dark:text-amber-400 font-sans">Cloud-Only Migration Trust Boundary</h4><p className="text-xs font-semibold leading-relaxed text-amber-700 dark:text-amber-500">Provider snapshots and cloud configuration are covered. Application internals still need manual validation after target boot.</p>{activeJob.metadata?.targetAccessProfile?.reusedSourceKeyPair && <p className="text-[11px] font-semibold text-amber-750 dark:text-amber-500/90">AWS key pair reuse is enabled for this clone. Use the existing PEM for the target.</p>}</div></div></div>
        ) : (
          <div className="h-full rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/35 dark:bg-blue-950/15"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" /><div className="space-y-1"><h4 className="text-sm font-extrabold text-blue-800 dark:text-blue-400 font-sans">Deep Inspection Mode Active</h4><p className="text-xs font-semibold leading-relaxed text-blue-700 dark:text-blue-500">Cloudcam can inspect services, containers, ports, and local dependencies via {activeJob.accessConfig?.method}.</p></div></div></div>
        )}
        {renderClassificationBanner()}
      </div>

      <OverviewGrid progressPercent={progressPercent} completedTaskCount={completedTaskCount} activeTasksCount={activeTasks.length} runningTask={runningTask} activeJobStatus={activeJob.status} pendingTaskCount={pendingTaskCount} targetHostLabel={targetHostLabel} targetHost={targetHost} activeJobAccessMode={activeJob.accessMode} activeJobAccessConfigMethod={activeJob.accessConfig?.method} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 animate-none">
        <div className="xl:col-span-8 flex flex-col gap-4">
          <TaskTimeline activeTasks={activeTasks} expandedTaskId={expandedTaskId} setExpandedTaskId={setExpandedTaskId} explainingTasks={explainingTasks} handleExplainTask={handleExplainTask} />
          <LiveConsoleLogs selectedLogLevel={selectedLogLevel} setSelectedLogLevel={setSelectedLogLevel} filteredTerminalLogs={filteredTerminalLogs} handleCopyText={handleCopyText} terminalScrollRef={terminalScrollRef} />
        </div>
        <div className="xl:col-span-4 flex flex-col gap-4">
          <WorkChecklist checklistItems={getChecklistItems()} />
          <TargetConnectionCard activeJob={activeJob} customSshUsername={customSshUsername} setCustomSshUsername={setCustomSshUsername} customSshKeyName={customSshKeyName} setCustomSshKeyName={setCustomSshKeyName} targetHost={targetHost} targetHostLabel={targetHostLabel} generatedSshCommand={generatedSshCommand} copiedSsh={copiedSsh} handleCopyText={handleCopyText} accessMode={accessMode} setAccessMode={setAccessMode} accessMethod={accessMethod} setAccessMethod={setAccessMethod} sshUsername={sshUsername} setSshUsername={setSshUsername} sshPort={sshPort} setSshPort={setSshPort} sshKey={sshKey} setSshKey={setSshKey} handleConfigureAccess={handleConfigureAccess} isConfiguringAccess={isConfiguringAccess} />
          <CutoverControls activeJob={activeJob} stopSourceAfterCutover={stopSourceAfterCutover} handleTransitionStatus={handleTransitionStatus} handleDownloadReport={handleDownloadReport} />
        </div>
      </div>
    </div>
  );
}
