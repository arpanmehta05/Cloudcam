"use client";

import React, { useMemo } from "react";
import { Download, Copy, Check } from "@/icons";

interface TerraformCodeEditorProps {
  format: "json" | "hcl";
  setFormat: (format: "json" | "hcl") => void;
  code: string;
  onCodeChange: (code: string) => void;
  handleDownload: () => void;
  handleCopy: () => void;
  copied: boolean;
  isReadOnly?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function TerraformCodeEditor({
  format,
  setFormat,
  code,
  onCodeChange,
  handleDownload,
  handleCopy,
  copied,
  isReadOnly = false,
  onFocus,
  onBlur,
}: TerraformCodeEditorProps) {
  const linesArr = useMemo(() => {
    const lineCount = code.split("\n").length;
    return Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);
  }, [code]);

  const editable = !isReadOnly;

  return (
    <div className="w-full max-w-full space-y-2 overflow-hidden min-w-0">
      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground font-sans">
        Code Editor
      </p>

      {/* Tabs and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0 bg-muted/40 rounded-xl p-1 border border-border/60">
        <div className="flex items-center gap-1 bg-card rounded-lg p-0.5 shadow-2xs border border-border/30 shrink-0">
          <button
            onClick={() => setFormat("json")}
            className={`rounded-md px-3.5 py-1 text-[10px] font-black transition cursor-pointer ${
              format === "json"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setFormat("hcl")}
            className={`rounded-md px-3.5 py-1 text-[10px] font-black transition cursor-pointer ${
              format === "hcl"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            HCL
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[10px] font-black text-muted-foreground shadow-2xs transition hover:bg-muted hover:text-foreground cursor-pointer"
            title={`Download ${format === "json" ? "main.tf.json" : "main.tf"}`}
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Download</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[10px] font-black text-muted-foreground shadow-2xs transition hover:bg-muted hover:text-foreground cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex flex-col rounded-xl overflow-hidden border border-[#1E293B] bg-[#090D16] w-full max-w-full shadow-lg min-w-0">
        {/* Editor Header */}
        <div className="flex items-center justify-between bg-[#04060A] px-4 py-2 border-b border-[#1E293B] select-none">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
            <span className="ml-2 font-mono text-[10px] font-bold text-[#64748B]">
              {format === "json" ? "main.tf.json" : "main.tf"}
            </span>
          </div>
          <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#475569]">
            {format} {editable ? "(Editable)" : "(Read-Only)"}
          </span>
        </div>

        {/* Text Area & Gutter container */}
        <div className="flex flex-row relative h-[22rem] w-full min-w-0 overflow-hidden">
          {/* Gutter */}
          <div className="w-10 select-none border-r border-[#1E293B] bg-[#04060A]/85 text-right pr-2.5 py-4 text-[#475569] font-mono text-[10.5px] leading-relaxed overflow-y-hidden">
            {linesArr.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>

          {/* Code Textarea / Pre */}
          {editable ? (
            <textarea
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              className="flex-1 resize-none bg-transparent py-4 px-3 text-[#E2E8F0] font-mono text-[10.5px] leading-relaxed outline-none border-none h-full overflow-y-auto whitespace-pre overflow-x-auto min-w-0 w-full"
              style={{ tabSize: 2 }}
              spellCheck={false}
            />
          ) : (
            <pre className="flex-1 bg-transparent py-4 px-3 text-[#E2E8F0] font-mono text-[10.5px] leading-relaxed outline-none border-none h-full overflow-y-auto whitespace-pre overflow-x-auto min-w-0 w-full select-text">
              {code}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
