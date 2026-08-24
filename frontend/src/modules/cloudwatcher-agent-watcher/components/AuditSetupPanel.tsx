"use client";

import { PromptBlock } from "./PromptBlock";

export interface AuditSetupPanelProps {
  ingestKey: string | null;
  keyLoading: boolean;
  keyError: string | null;
  onRetryKey: () => void;
  expired: boolean;
  agentId: string;
  agentName: string;
  reportName: string;
}

export function AuditSetupPanel({
  ingestKey,
  keyLoading,
  keyError,
  onRetryKey,
  expired,
  agentId,
  agentName,
  reportName,
}: AuditSetupPanelProps) {
  return (
    <section id="check-prompt" className="border-y border-[#E2E8F0] bg-white scroll-mt-24">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[0.72fr_1.28fr] lg:px-6 lg:py-14">
        <div className="lg:pr-8">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1A56DB] text-xs font-extrabold text-white">1</span>
          <p className="mt-5 text-sm font-bold text-[#1A56DB]">Run the audit</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0F172A]">Hand the inspection to the agent in your codebase.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#64748B]">The prompt includes a short-lived submission credential. It is only for this run and is revoked once the report arrives.</p>
          <ol className="mt-8 space-y-4 border-l border-[#DBEAFE] pl-5">
            {[
              "Copy the prepared prompt.",
              "Paste it into your coding agent.",
              "Keep this page open while the report returns.",
            ].map((item, index) => (
              <li key={item} className="relative text-sm font-medium text-[#475569]">
                <span className="absolute -left-[29px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#DBEAFE] text-[9px] font-extrabold text-[#1A56DB]">{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>

        <PromptBlock
          ingestKey={ingestKey}
          keyLoading={keyLoading}
          keyError={keyError}
          expired={expired}
          onRetryKey={onRetryKey}
          agentId={agentId}
          agentName={agentName}
          reportName={reportName}
        />
      </div>
    </section>
  );
}
