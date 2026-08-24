"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "@/icons";
import { stringifyValue } from "../lib";
import type { PassFailStatus, TestResult } from "../types";

export interface TestResultListProps {
  testResults: TestResult[];
}

type Filter = "all" | "attention" | "pass";

const statusMeta: Record<PassFailStatus, { label: string; badge: string; rail: string; summary: string }> = {
  pass: { label: "Passed", badge: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1A56DB]", rail: "border-l-[#1A56DB]", summary: "Control held for this observed case" },
  fail: { label: "Failed", badge: "border-[#0F172A] bg-white text-[#0F172A]", rail: "border-l-[#0F172A]", summary: "Requires an engineering decision" },
  manual_review: { label: "Needs review", badge: "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]", rail: "border-l-[#94A3B8]", summary: "Evidence is not conclusive" },
  not_run: { label: "Not run", badge: "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]", rail: "border-l-[#CBD5E1]", summary: "No evidence was collected" },
};

function isAttention(status: PassFailStatus) {
  return status === "fail" || status === "manual_review" || status === "not_run";
}

function TestResultRow({ result, open, onToggle }: { result: TestResult; open: boolean; onToggle: () => void }) {
  const input = stringifyValue(result.input);
  const output = stringifyValue(result.output);
  const meta = statusMeta[result.pass_fail_status];
  const displayId = result.id ? result.id.slice(-5).toUpperCase() : "—";
  const hasTrace = result.latency_ms !== undefined || result.cost_usd !== undefined || (result.citations?.length ?? 0) > 0 || (result.tool_calls?.length ?? 0) > 0;

  return (
    <article className={`overflow-hidden rounded-xl border border-[#E2E8F0] border-l-4 bg-white transition-[border-color,box-shadow] hover:border-[#CBD5E1] ${meta.rail} ${open ? "shadow-[0_10px_24px_rgba(15,23,42,0.07)]" : ""}`}>
      <button type="button" onClick={onToggle} className="grid w-full gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-[#FAFBFC] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1A56DB] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5" aria-expanded={open}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-extrabold capitalize text-[#0F172A]">{result.category.replace(/[_-]/g, " ")}</span>
            <span className="hidden font-mono text-[10px] font-bold text-[#94A3B8] sm:inline">#{displayId}</span>
          </div>
          <p className="mt-1 break-words text-sm text-[#475569]">{result.test_name}</p>
          <p className="mt-1.5 text-xs text-[#64748B]">{result.notes || meta.summary}</p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-[11px] font-semibold text-[#64748B]">{meta.summary}</span>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${meta.badge}`}>{meta.label}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
          <div className="space-y-5 border-t border-[#E2E8F0] bg-[#FAFBFC] p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <EvidenceStat label="Disposition" value={meta.label} />
              <EvidenceStat label="Latency" value={result.latency_ms === undefined ? "Not captured" : `${Math.round(result.latency_ms)} ms`} />
              <EvidenceStat label="Citations" value={result.citations === undefined ? "Not captured" : String(result.citations.length)} />
              <EvidenceStat label="Tool calls" value={result.tool_calls === undefined ? "Not captured" : String(result.tool_calls.length)} />
            </div>
            {(input || output) && <div className="grid gap-4 xl:grid-cols-2">
              {input && <CodeBlock label="Test input" value={input} />}
              {output && <CodeBlock label="Observed output" value={output} />}
            </div>}
            {hasTrace && <TraceDetails result={result} />}
            {result.metadata && <CodeBlock label="Captured metadata" value={stringifyValue(result.metadata)} />}
          </div>
        </motion.div>}
      </AnimatePresence>
    </article>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">{label}</p><p className="mt-1 truncate text-xs font-bold text-[#334155]">{value}</p></div>; }
function CodeBlock({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#64748B]">{label}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#E2E8F0] bg-white p-3.5 font-mono text-xs leading-5 text-[#334155]">{value}</pre></div>; }
function TraceDetails({ result }: { result: TestResult }) { return <div className="rounded-lg border border-[#E2E8F0] bg-white p-3.5 text-xs text-[#475569]"><p className="font-extrabold uppercase tracking-wider text-[#64748B]">Trace evidence</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2"><span>Cost: {result.cost_usd === undefined ? "Not captured" : `$${result.cost_usd.toFixed(6)}`}</span><span>Citations: {result.citations?.length ?? 0}</span><span>Tool calls: {result.tool_calls?.length ?? 0}</span></div></div>; }

export function TestResultList({ testResults }: TestResultListProps) {
  const [filter, setFilter] = useState<Filter>("attention");
  const firstAttention = testResults.find((result) => isAttention(result.pass_fail_status))?.id ?? testResults[0]?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(firstAttention);
  const counts = useMemo(() => ({ attention: testResults.filter((result) => isAttention(result.pass_fail_status)).length, pass: testResults.filter((result) => result.pass_fail_status === "pass").length }), [testResults]);
  const visible = testResults.filter((result) => filter === "all" || (filter === "attention" ? isAttention(result.pass_fail_status) : result.pass_fail_status === "pass"));

  if (!testResults.length) return <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-sm text-[#64748B]">This report has no individual test results.</p>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-2">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Evidence filters">
        {([ ["attention", `Needs attention (${counts.attention})`], ["all", `All checks (${testResults.length})`], ["pass", `Passed (${counts.pass})`] ] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${filter === key ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"}`}>{label}</button>)}
      </div>
      <p className="px-2 text-xs text-[#64748B]">Select a row to inspect the captured evidence.</p>
    </div>
    {visible.length ? <div className="space-y-2">{visible.map((result) => <TestResultRow key={result.id} result={result} open={openId === result.id} onToggle={() => setOpenId((current) => current === result.id ? null : result.id)} />)}</div> : <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFCFF] p-6 text-sm text-[#64748B]">No checks match this view.</p>}
  </div>;
}
