import type { ReportDetail } from "../types";

export interface MetadataBarProps {
  report: ReportDetail;
}

export function MetadataBar({ report }: MetadataBarProps) {
  const targetName = report.raw_report_json?.target?.name || "system_context_active";
  const agentName = report.raw_report_json?.agent_name || report.agent_id || "v2.4.0_enterprise_hardened";
  const timestamp = report.submitted_at;
  const formattedTimestamp = new Date(timestamp).toISOString().replace(/\.\d+Z$/, 'Z');

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 mt-8 mb-8">
      <div className="w-full bg-white rounded-xl border border-[#E2E8F0]/80 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E8F0]/60 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="p-5 flex flex-col justify-center">
          <p className="font-sans text-[11px] font-bold tracking-wider text-[#94A3B8] mb-1 uppercase">HARNESS AUDIT</p>
          <p className="font-mono text-[12px] font-semibold text-[#334155]">{targetName}</p>
        </div>
        <div className="p-5 flex flex-col justify-center">
          <p className="font-sans text-[11px] font-bold tracking-wider text-[#94A3B8] mb-1 uppercase">PROBE SUITE</p>
          <p className="font-mono text-[12px] font-semibold text-[#334155]">{agentName}</p>
        </div>
        <div className="p-5 flex flex-col justify-center">
          <p className="font-sans text-[11px] font-bold tracking-wider text-[#94A3B8] mb-1 uppercase">SCORED REPORT</p>
          <p className="font-mono text-[12px] font-semibold text-[#1A56DB]">TIMESTAMP: {formattedTimestamp}</p>
        </div>
      </div>
    </div>
  );
}
