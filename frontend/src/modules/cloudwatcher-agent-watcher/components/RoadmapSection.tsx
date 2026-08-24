"use client";

import { CheckSquare, History, Rocket } from "@/icons";
import type { ReportDetail } from "../types";
import { SectionShell, SectionHead } from "./primitives";

type RecordValue = Record<string, unknown>;

export function RoadmapSection({ report }: { report: ReportDetail }) {
  const auditReport = report.raw_report_json.audit_report;
  const roadmap = Array.isArray(auditReport?.roadmap) ? auditReport.roadmap : [];
  const backlog = Array.isArray(auditReport?.backlog) ? auditReport.backlog : [];

  if (!roadmap.length && !backlog.length) {
    return (
      <SectionShell>
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#F1F5F9] text-[#64748B]"><History className="h-4 w-4" /></span>
          <div>
            <h2 className="text-base font-extrabold text-[#0F172A]">Remediation roadmap</h2>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">No remediation plan was submitted with this report. The evidence below is still available for review.</p>
          </div>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell padded={false}>
      <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <SectionHead
          eyebrow="What to do next"
          title="Your action plan"
          sub="Everything the audit found, turned into work you can hand to your team — first the plan in order, then a simple checklist of tasks."
          icon={Rocket}
          accent="#1A56DB"
        />
      </div>

      {roadmap.length > 0 && (
        <div className="px-5 py-5 sm:px-6">
          <p className="text-sm font-extrabold text-[#0F172A]">Plan of attack</p>
          <p className="mt-0.5 text-xs text-[#64748B]">Tackle these stages in order — each one builds on the last.</p>
          <ol className="mt-4 space-y-3">
            {roadmap.map((item, index) => (
              <PhaseRow key={`roadmap-${index}`} item={item} index={index} last={index === roadmap.length - 1} />
            ))}
          </ol>
        </div>
      )}

      {backlog.length > 0 && (
        <div className="border-t border-[#E2E8F0] bg-[#FAFBFC] px-5 py-5 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
            <CheckSquare className="h-4 w-4 text-[#1A56DB]" /> Task checklist
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#64748B]">
            A ready-to-assign to-do list. Each row is one concrete task an engineer can pick up to make the system safer or more reliable — start at the top and work down.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#E7ECF2] bg-white">
            <div className="flex items-center gap-3.5 border-b border-[#EAEFF4] bg-[#FAFBFC] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">
              <span className="w-6 text-center">#</span>
              <span className="flex-1">Task</span>
            </div>
            <div className="divide-y divide-[#EAEFF4]">
              {backlog.map((item, index) => (
                <BacklogRow key={`backlog-${index}`} item={item} index={index} />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function PhaseRow({ item, index, last }: { item: unknown; index: number; last: boolean }) {
  const value = record(item);
  const title = string(value?.phase) || string(value?.goal) || string(item) || `Phase ${index + 1}`;
  const description = string(value?.description) || (string(value?.goal) !== title ? string(value?.goal) : "");
  const timeframe = string(value?.timeframe) || string(value?.duration) || string(value?.eta);
  return (
    <li className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1A56DB] text-xs font-extrabold text-white">{index + 1}</span>
        {!last && <span className="mt-1 w-px flex-1 bg-[#E2E8F0]" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-extrabold text-[#0F172A]">{title}</h4>
          {timeframe && <span className="rounded-md border border-[#E2E8F0] bg-white px-2 py-0.5 text-[10px] font-bold text-[#64748B]">{timeframe}</span>}
        </div>
        {description && <p className="mt-1.5 text-sm leading-6 text-[#64748B]">{description}</p>}
      </div>
    </li>
  );
}

function BacklogRow({ item, index }: { item: unknown; index: number }) {
  const value = record(item);
  const ref = string(value?.ticket) || string(value?.id) || string(value?.key);
  const task = string(value?.title) || string(value?.description) || string(value?.detail) || string(value?.task) || string(item) || `Task ${index + 1}`;
  const sub = (() => {
    const d = string(value?.description) || string(value?.detail);
    return d && d !== task ? d : "";
  })();
  const priority = string(value?.priority);
  const effort = string(value?.effort) || string(value?.estimate);
  return (
    <div className="flex items-start gap-3.5 px-4 py-3.5">
      <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-[#94A3B8]">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-bold text-[#0F172A]">{task}</p>
          {ref && <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#94A3B8]">{ref}</span>}
        </div>
        {sub && <p className="mt-1 text-xs leading-5 text-[#64748B]">{sub}</p>}
        {(priority || effort) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {priority && <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">Priority: {priority}</span>}
            {effort && <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">Effort: {effort}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
