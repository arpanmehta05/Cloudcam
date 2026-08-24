"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, CheckCircle2, FileSearch } from "@/icons";
import { formatDateTime, summarizeCategories } from "../lib";
import { buildDeepReport } from "../reportData";
import type { ReportDetail } from "../types";
import { ExecutiveBrief } from "./ExecutiveBrief";
import { HarnessMatrixSection } from "./HarnessMatrixSection";
import { HarnessTaxonomyGrid } from "./HarnessTaxonomyGrid";
import { ScoreIntegrity } from "./ScoreIntegrity";
import { PriorityFindings } from "./PriorityFindings";
import { GapAnalysisTable } from "./GapAnalysisTable";
import { ArchitectureBlueprint } from "./ArchitectureBlueprint";
import { RoadmapSection } from "./RoadmapSection";
import { ClosingBrief } from "./ClosingBrief";
import { SurfaceMap } from "./SurfaceMap";
import { ReportContents } from "./ReportContents";
import { TestResultList } from "./TestResultList";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.2, 0, 0.2, 1] as const } },
};

const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export function ReportView({ report }: { report: ReportDetail }) {
  const deep = buildDeepReport(report);
  const targetName = deep.target.name;
  const failingCount = report.test_results.filter((result) => result.pass_fail_status === "fail").length;
  const reviewCount = report.test_results.filter((result) => result.pass_fail_status === "manual_review" || result.pass_fail_status === "not_run").length;
  const weakEvidenceCount = summarizeCategories(report.test_results, report.category_scores).filter((category) => category.failed === 0 && category.manualReview + category.notRun === 0 && category.ratio < 0.7).length;
  const score = report.score === null ? null : Math.round(report.score * 100);
  const scoreLabel = score === null ? "Awaiting score" : `${score}/100`;
  const healthTone = failingCount > 0 ? "text-[#0F172A]" : reviewCount > 0 ? "text-[#475569]" : "text-[#1A56DB]";

  // Which optional sections have content — drives both the contents rail and
  // whether a section renders at all.
  const has = {
    brief: Boolean(deep.executiveSummary || deep.target.model || deep.target.environment),
    coverage: deep.taxonomy.some((area) => area.status !== "unknown"),
    score: report.applied_score_cap !== null || deep.criticalGaps.length > 0 || deep.scoreCaps.length > 0 || deep.doNotBuildYet.length > 0,
    findings: report.test_results.some((result) => result.pass_fail_status !== "pass"),
    gaps: deep.gapAnalysis.length > 0,
    architecture: deep.recommendedModules.length > 0 || deep.dataModels.length > 0,
    roadmap: true,
    closing: deep.finalRecommendations.length > 0 || deep.openQuestions.length > 0,
    surface: [
      deep.surface.filesInspected,
      deep.surface.aiSurfaceAreas,
      deep.surface.modelCallSites,
      deep.surface.retrievalPaths,
      deep.surface.toolPaths,
      deep.surface.chatOrMemoryPaths,
      deep.surface.testOrEvalPaths,
      deep.surface.deploymentPaths,
      deep.surface.existingHarness,
      deep.surface.harnessGaps,
    ].some((list) => list.length > 0),
  };

  const sections = [
    { id: "cw-brief", label: "Summary", show: true },
    { id: "cw-posture", label: "Posture", show: true },
    { id: "cw-coverage", label: "Coverage", show: has.coverage },
    { id: "cw-score", label: "Score", show: has.score },
    { id: "cw-findings", label: "Findings", show: has.findings },
    { id: "cw-gaps", label: "Gaps", show: has.gaps },
    { id: "cw-architecture", label: "Architecture", show: has.architecture },
    { id: "cw-roadmap", label: "Roadmap", show: has.roadmap },
    { id: "cw-closing", label: "Next steps", show: has.closing },
    { id: "cw-surface", label: "Evidence", show: has.surface },
    { id: "cw-ledger", label: "Ledger", show: true },
  ].filter((section) => section.show);

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8 pb-5">
      <motion.header id="cw-brief" variants={fadeUp} className="scroll-mt-28 overflow-hidden rounded-2xl border border-[#DCE3EC] bg-white shadow-[0_16px_50px_rgba(15,23,42,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-6 px-5 py-5 sm:px-6 sm:py-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#64748B]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1A56DB]" />
              Completed assessment
            </div>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl">Agent harness audit</h2>
            <p className="mt-2 text-sm text-[#64748B]">Evidence-led posture, harness coverage, and the decisions worth making next.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <FileSearch className="h-4 w-4 shrink-0 text-[#1A56DB]" />
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Audit target</p><p className="mt-0.5 max-w-56 truncate font-mono text-xs font-bold text-[#334155]">{targetName}</p></div>
          </div>
        </div>
        <div className="grid border-t border-[#E2E8F0] sm:grid-cols-2 xl:grid-cols-4">
          <BriefMetric label="Evidence score" value={scoreLabel} detail={report.applied_score_cap !== null ? "Score cap applied" : "Evidence-adjusted"} tone="text-[#1A56DB]" />
          <BriefMetric label="Issues to resolve" value={String(failingCount)} detail={failingCount ? "Requires engineering action" : "No failed checks"} tone={failingCount ? "text-[#0F172A]" : "text-[#1A56DB]"} />
          <BriefMetric label="Coverage gaps" value={String(reviewCount + weakEvidenceCount)} detail={reviewCount + weakEvidenceCount ? "Needs validation" : "No open reviews"} tone={reviewCount + weakEvidenceCount ? "text-[#475569]" : "text-[#1A56DB]"} />
          <BriefMetric label="Checks captured" value={String(report.test_results.length)} detail={`Submitted ${formatDateTime(report.submitted_at)}`} tone={healthTone} />
        </div>
      </motion.header>

      <ReportContents sections={sections} />

      {has.brief && <motion.div variants={fadeUp}><ExecutiveBrief report={report} deep={deep} /></motion.div>}

      <motion.div id="cw-posture" variants={fadeUp} className="scroll-mt-28"><HarnessMatrixSection report={report} /></motion.div>

      {has.coverage && <motion.div id="cw-coverage" variants={fadeUp} className="scroll-mt-28"><HarnessTaxonomyGrid deep={deep} /></motion.div>}

      {has.score && <motion.div id="cw-score" variants={fadeUp} className="scroll-mt-28"><ScoreIntegrity report={report} deep={deep} /></motion.div>}

      {has.findings && <motion.div id="cw-findings" variants={fadeUp} className="scroll-mt-28"><PriorityFindings testResults={report.test_results} /></motion.div>}

      {has.gaps && <motion.div id="cw-gaps" variants={fadeUp} className="scroll-mt-28"><GapAnalysisTable deep={deep} /></motion.div>}

      {has.architecture && <motion.div id="cw-architecture" variants={fadeUp} className="scroll-mt-28"><ArchitectureBlueprint deep={deep} /></motion.div>}

      <motion.div id="cw-roadmap" variants={fadeUp} className="scroll-mt-28"><RoadmapSection report={report} /></motion.div>

      {has.closing && <motion.div id="cw-closing" variants={fadeUp} className="scroll-mt-28"><ClosingBrief deep={deep} /></motion.div>}

      {has.surface && <motion.div id="cw-surface" variants={fadeUp} className="scroll-mt-28"><SurfaceMap deep={deep} /></motion.div>}

      <motion.section id="cw-ledger" variants={fadeUp} className="scroll-mt-28 space-y-4 border-t border-[#E2E8F0] pt-8">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#64748B]">Evidence ledger</p><h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#0F172A]">Checks, payloads, and observed outputs</h3><p className="mt-1 text-sm text-[#64748B]">Open a check to review the exact input, response, telemetry, and captured metadata.</p></div>
          <span className="hidden rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-bold text-[#64748B] sm:block">{report.test_results.length} total checks</span>
        </div>
        <TestResultList testResults={report.test_results} />
      </motion.section>
    </motion.div>
  );
}

function BriefMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className="border-b border-[#E2E8F0] px-5 py-4 last:border-b-0 sm:px-6 xl:border-b-0 xl:[&:not(:first-child)]:border-l"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#94A3B8]">{label}</p><p className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${tone}`}>{value}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#64748B]"><ArrowDownRight className="h-3 w-3 text-[#94A3B8]" />{detail}</p></div>;
}
