"use client";

import { AlertTriangle, CheckCircle2, Clock3, FileSearch, XCircle } from "@/icons";
import { stringifyValue } from "../lib";
import type { PassFailStatus, TestResult } from "../types";

type AttentionStatus = Exclude<PassFailStatus, "pass">;

const statusPresentation: Record<AttentionStatus, { label: string; icon: typeof XCircle; tone: string; eyebrow: string }> = {
  fail: { label: "Action required", icon: XCircle, tone: "border-[#0F172A] bg-white text-[#0F172A]", eyebrow: "Observed failure" },
  manual_review: { label: "Validate evidence", icon: AlertTriangle, tone: "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]", eyebrow: "Inconclusive evidence" },
  not_run: { label: "Coverage gap", icon: Clock3, tone: "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]", eyebrow: "Evidence was not collected" },
};

function FindingCard({ result, index }: { result: TestResult; index: number }) {
  const presentation = statusPresentation[result.pass_fail_status as AttentionStatus];
  const Icon = presentation.icon;
  const input = stringifyValue(result.input);
  const output = stringifyValue(result.output);
  const evidence = result.metadata?.evidence ?? [];
  const verification = result.metadata?.verification;
  const risk = result.metadata?.risk;
  const remediation = result.metadata?.remediation;

  return (
    <article className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${presentation.tone}`}><Icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#94A3B8]">{presentation.eyebrow} · finding {String(index + 1).padStart(2, "0")}</p>
            <h4 className="mt-1 text-sm font-extrabold text-[#0F172A] break-words">{result.test_name}</h4>
            <p className="mt-1 text-xs font-semibold capitalize text-[#64748B]">{result.category.replace(/[_-]/g, " ")}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${presentation.tone}`}>{presentation.label}</span>
      </div>

      <div className="border-t border-[#E2E8F0] bg-[#FAFBFC] px-5 py-4">
        <p className="whitespace-pre-line break-words text-sm leading-6 text-[#334155]">
          {result.notes || "The audit did not include an analyst note for this finding. Inspect the captured input and output below before closing it."}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Signal label="Latency" value={result.latency_ms === undefined ? "Not captured" : `${Math.round(result.latency_ms)} ms`} />
          <Signal label="Citations" value={result.citations === undefined ? "Not captured" : String(result.citations.length)} />
          <Signal label="Tool calls" value={result.tool_calls === undefined ? "Not captured" : String(result.tool_calls.length)} />
        </div>

        {(risk || remediation || verification) && (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {risk && <Field label={`${risk.severity} risk · ${risk.affected_surface}`}>{`${risk.impact}\nLikelihood: ${risk.likelihood}`}</Field>}
            {remediation && <Field label="Recommended action">{`${remediation.recommended_action}\nValidate: ${remediation.validation}`}</Field>}
            {verification && <Field label={`Verified in ${verification.environment}`}>{`${verification.method}: ${verification.outcome}`}</Field>}
          </div>
        )}

        {(input || output) && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {input && <CodeField label="Trigger / test input" value={input} />}
            {output && <CodeField label="Observed response" value={output} />}
          </div>
        )}

        {evidence.length > 0 && (
          <div className="mt-4 border-t border-[#E2E8F0] pt-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">Supporting evidence ({evidence.length})</p>
            <div className="mt-2 space-y-2">
              {evidence.map((item, evidenceIndex) => (
                <div key={`${item.location}-${evidenceIndex}`} className="min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5">
                  <p className="break-words font-mono text-[11px] font-bold text-[#1A56DB]">{item.source_type} · {item.location}</p>
                  <p className="mt-1 break-words text-xs font-semibold text-[#334155]">{item.claim}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-[#64748B]">{item.excerpt}</p>
                  {item.reliability && <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Reliability: {item.reliability}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p><p className="mt-1 text-xs font-bold text-[#334155]">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#E2E8F0] bg-white p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">{label}</p>
      <p className="mt-2 whitespace-pre-line break-words text-xs leading-5 text-[#475569]">{children}</p>
    </div>
  );
}

function CodeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">{label}</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#E2E8F0] bg-white p-3 font-mono text-[11px] leading-5 text-[#334155]">{value}</pre>
    </div>
  );
}

export function PriorityFindings({ testResults }: { testResults: TestResult[] }) {
  const findings = testResults.filter((result) => result.pass_fail_status !== "pass");

  if (!findings.length) {
    return <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-6 py-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#BFDBFE] bg-white text-[#1A56DB]"><CheckCircle2 className="h-4 w-4" /></span><div><p className="text-sm font-extrabold text-[#0F172A]">No unresolved findings in this run</p><p className="mt-1 text-sm text-[#64748B]">The detailed evidence ledger below still shows exactly what was exercised and what the audit could verify.</p></div></div></section>;
  }

  return (
    <section className="rounded-2xl border border-[#DCE3EC] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">Decision brief</p><h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#0F172A]">What needs attention, and why</h3><p className="mt-1 max-w-2xl text-sm text-[#64748B]">Each finding shows the full test, the exact input and observed response, the risk, the recommended fix, and every piece of supporting evidence captured during the audit.</p></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#0F172A] bg-white px-3 py-1.5 text-xs font-bold text-[#0F172A]"><FileSearch className="h-3.5 w-3.5" />{findings.length} open finding{findings.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-6 space-y-3">{findings.map((result, index) => <FindingCard key={result.id} result={result} index={index} />)}</div>
    </section>
  );
}
