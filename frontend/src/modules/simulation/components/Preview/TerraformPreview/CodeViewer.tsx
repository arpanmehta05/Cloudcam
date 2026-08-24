"use client";

import React from "react";
import { TerraformCodeEditor } from "../TerraformCodeEditor";

interface CodeViewerProps {
  format: "json" | "hcl";
  setFormat: (format: "json" | "hcl") => void;
  code: string;
  onCodeChange: (code: string) => void;
  handleDownload: () => void;
  handleCopy: () => void;
  copied: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function CodeViewer({
  format,
  setFormat,
  code,
  onCodeChange,
  handleDownload,
  handleCopy,
  copied,
  onFocus,
  onBlur,
}: CodeViewerProps) {
  return (
    <div className="space-y-4">
      <TerraformCodeEditor
        format={format}
        setFormat={setFormat}
        code={code}
        onCodeChange={onCodeChange}
        handleDownload={handleDownload}
        handleCopy={handleCopy}
        copied={copied}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  );
}
