"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Loader2 } from "@/icons";
import { buildCheckPrompt } from "../promptTemplate";

export function PromptBlock({
  ingestKey,
  keyLoading,
  keyError,
  onRetryKey,
  expired = false,
  agentId,
  reportName,
  agentName,
}: {
  ingestKey: string | null;
  keyLoading: boolean;
  keyError: string | null;
  onRetryKey: () => void;
  expired?: boolean;
  agentId?: string;
  reportName?: string;
  agentName?: string;
}) {
  const prompt = buildCheckPrompt(ingestKey ?? undefined, agentId, reportName, agentName);
  const visiblePrompt = redactPrompt(prompt, ingestKey);
  const hasKey = !!ingestKey && !expired;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-extrabold text-[#0F172A]">Prepared audit prompt</p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            {expired
              ? "This run is complete — the key has been revoked."
              : "Copy this block and paste it into your coding agent to start the audit."}
          </p>
        </div>
        <button
          type="button"
          id="copy-prompt-btn"
          onClick={keyError ? onRetryKey : copy}
          disabled={keyLoading || expired || (!hasKey && !keyError)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1A56DB] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1040A0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {keyLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {keyLoading ? "Preparing" : keyError ? "Try again" : copied ? "Copied!" : "Copy prompt"}
        </button>
      </div>

      {/* Code area */}
      <div className="bg-[#0F172A] p-1">
        <pre className="max-h-[440px] overflow-auto p-5 font-mono text-[12.5px] leading-6 text-[#DCE7F7] sm:p-6">
          <code>
            {expired
              ? "Audit complete. Use the report below to export a PDF or run another check."
              : visiblePrompt}
          </code>
        </pre>
      </div>
    </motion.div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactPrompt(prompt: string, ingestKey: string | null) {
  if (!ingestKey) {
    return prompt.replace(
      /Ingest key:\s+<YOUR_CLOUDWATCHER_INGEST_KEY>/,
      "Secure submission credential: included when copied",
    );
  }
  return prompt.replace(
    new RegExp(`Ingest key:\\s+${escapeRegex(ingestKey)}`),
    "Secure submission credential: included when copied",
  );
}
