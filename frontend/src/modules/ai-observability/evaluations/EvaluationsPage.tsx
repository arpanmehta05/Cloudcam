"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck } from "@/icons";

import { AuditHistory } from "./components/AuditHistory";
import { AuditQueue } from "./components/AuditQueue";
import { EvaluationErrorDialog } from "./components/EvaluationErrorDialog";
import { EvaluationStatsCards } from "./components/EvaluationStatsCards";
import { MetricBenchmarks } from "./components/MetricBenchmarks";
import { useEvaluationsDashboard } from "./hooks/useEvaluationsDashboard";

export default function EvaluationsPage() {
  const dashboard = useEvaluationsDashboard();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <div>
            <h1 className="text-lg font-display font-bold tracking-tight">LLM-as-a-Judge Auditing</h1>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Automated grounding, safety, toxicity, and relevance audits
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={dashboard.fetchData}
          disabled={dashboard.loading}
          className="h-8 text-xs font-mono gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${dashboard.loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <EvaluationStatsCards
        loading={dashboard.loading}
        stats={dashboard.stats}
        selectedJudgeModel={dashboard.selectedJudgeModel}
        selectedJudgeProvider={dashboard.selectedJudgeProvider}
        customJudgeProviderName={dashboard.customJudgeProviderName}
      />

      <MetricBenchmarks stats={dashboard.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <AuditHistory
            loading={dashboard.loading}
            evaluations={dashboard.evaluations}
            expandedEvalId={dashboard.expandedEvalId}
            setExpandedEvalId={dashboard.setExpandedEvalId}
          />
        </div>

        <div className="lg:col-span-4 space-y-4">
          <AuditQueue
            loading={dashboard.loading}
            pendingLogs={dashboard.pendingLogs}
            auditingRequestId={dashboard.auditingRequestId}
            selectedJudgeProvider={dashboard.selectedJudgeProvider}
            setSelectedJudgeProvider={dashboard.setSelectedJudgeProvider}
            customJudgeProviderName={dashboard.customJudgeProviderName}
            setCustomJudgeProviderName={dashboard.setCustomJudgeProviderName}
            selectedJudgeModel={dashboard.selectedJudgeModel}
            setSelectedJudgeModel={dashboard.setSelectedJudgeModel}
            customJudgeApiKey={dashboard.customJudgeApiKey}
            setCustomJudgeApiKey={dashboard.setCustomJudgeApiKey}
            handleRunAudit={dashboard.handleRunAudit}
          />
        </div>
      </div>

      <EvaluationErrorDialog
        errorModal={dashboard.errorModal}
        setErrorModal={dashboard.setErrorModal}
        handleRunAudit={dashboard.handleRunAudit}
      />
    </div>
  );
}
