"use client";

import { useState } from "react";
import { Check, Clipboard } from "@/icons";
import { Button } from "@/components/ui/button";

function highlightCode(code: string) {
  // 1. Check if it's an environment variables block
  if (code.includes("=") && !code.includes("const ") && !code.includes("import ") && !code.includes("from ")) {
    return code.split("\n").map((line, idx) => {
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const key = line.substring(0, eqIdx);
        const val = line.substring(eqIdx + 1);
        return (
          <span key={idx} className="block">
            <span className="text-violet-400 font-semibold">{key}</span>
            <span className="text-slate-400">=</span>
            <span className="text-amber-300">{val}</span>
          </span>
        );
      }
      return <span key={idx} className="block">{line}</span>;
    });
  }

  // 2. Check if it's a single-line installation command
  if ((code.startsWith("npm") || code.startsWith("pip")) && !code.includes("\n")) {
    const parts = code.split(" ");
    if (parts.length >= 2) {
      return (
        <span>
          <span className="text-violet-400 font-semibold">{parts[0]}</span>{" "}
          <span className="text-sky-300">{parts[1]}</span>{" "}
          <span className="text-slate-300">{parts.slice(2).join(" ")}</span>
        </span>
      );
    }
  }

  // 3. General JS/TS/Python/LangChain syntax highlighting using regex lexer
  const regex = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\/\/.*|#.*)|(\b(?:import|from|const|let|var|new|await|async|return|class|def|as|try|except|with|pass|true|false|null|undefined|process|env)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\())|(\b\d+\b)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    // Add plain text before match
    if (matchIndex > lastIndex) {
      elements.push(code.substring(lastIndex, matchIndex));
    }

    if (match[1]) {
      // String
      elements.push(
        <span key={matchIndex} className="text-amber-300">
          {matchText}
        </span>
      );
    } else if (match[2]) {
      // Comment - highlight green!
      elements.push(
        <span key={matchIndex} className="text-emerald-400 font-mono italic">
          {matchText}
        </span>
      );
    } else if (match[3]) {
      // Keyword
      elements.push(
        <span key={matchIndex} className="text-violet-400 font-semibold">
          {matchText}
        </span>
      );
    } else if (match[4]) {
      // Function call
      elements.push(
        <span key={matchIndex} className="text-sky-300">
          {matchText}
        </span>
      );
    } else if (match[5]) {
      // Number
      elements.push(
        <span key={matchIndex} className="text-rose-400">
          {matchText}
        </span>
      );
    } else {
      elements.push(matchText);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    elements.push(code.substring(lastIndex));
  }

  return elements;
}

export function SetupCodeBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="group relative flex items-start gap-2 rounded-lg border border-slate-800 bg-[#0B0F19] p-4 text-slate-300 shadow-md">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
        {highlightCode(value)}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        onClick={copy}
        title="Copy"
        className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white shrink-0 transition-colors"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Clipboard className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
