"use client";

import { useState } from "react";
import { Check, Copy } from "@/icons";
import { cn } from "@/lib/utils";

type DocsCodeBlockProps = {
  title?: string;
  code: string;
  className?: string;
};

async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function DocsCodeBlock({ title = "Command", code, className }: DocsCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const normalizedCode = code.trim();

  const handleCopy = async () => {
    try {
      await copyText(normalizedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard errors for now.
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#1F2937] bg-[#0B1220] text-[#E2E8F0] shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#1F2937] px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{title}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E2E8F0] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          title={copied ? "Copied" : "Copy to clipboard"}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 text-sm leading-6 text-[#E2E8F0] overflow-x-auto">
        <code className="whitespace-pre font-mono">{normalizedCode}</code>
      </pre>
    </div>
  );
}
