"use client";

import { Download, Loader2, RotateCcw } from "@/icons";

export interface AgentWatcherFooterProps {
  pdfLoading: boolean;
  pdfError: string | null;
  onDownloadPdf: () => void;
  onNewRun: () => void;
}

export function AgentWatcherFooter({
  pdfLoading,
  pdfError,
  onDownloadPdf,
  onNewRun,
}: AgentWatcherFooterProps) {
  return (
    <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-[#0F172A]">Audit report ready</p>
          <p className="mt-1 text-xs text-[#64748B]">Export the full report as a PDF, or start a fresh, isolated run.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-bold text-[#334155] transition-colors hover:border-[#94A3B8] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin text-[#64748B]" /> : <Download className="h-4 w-4 text-[#64748B]" />}
            {pdfLoading ? "Preparing…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={onNewRun}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A56DB] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(26,86,219,0.25)] transition-colors hover:bg-[#1040A0]"
          >
            <RotateCcw className="h-4 w-4" />
            New audit
          </button>
        </div>
      </div>
      {pdfError && (
        <p className="mt-3 border-t border-[#F1F5F9] pt-3 text-xs font-semibold text-[#B42318]">{pdfError}</p>
      )}
    </div>
  );
}
