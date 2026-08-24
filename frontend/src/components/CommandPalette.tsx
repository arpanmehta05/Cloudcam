"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "@/icons";

interface Command {
  label: string;
  hint: string;
  href: string;
  keywords?: string;
}

const COMMANDS: Command[] = [
  { label: "Overview", hint: "AI Observability", href: "/ai-observability", keywords: "home dashboard" },
  { label: "Traces", hint: "Trace Explorer", href: "/ai-observability/traces", keywords: "spans requests" },
  { label: "Sessions", hint: "Sessions", href: "/ai-observability/sessions" },
  { label: "Users", hint: "End users", href: "/ai-observability/users" },
  { label: "Playground", hint: "Prompts", href: "/ai-observability/playground" },
  { label: "Evaluations", hint: "Quality scores", href: "/ai-observability/evaluations", keywords: "judge evals" },
  { label: "Cost", hint: "Cost analytics", href: "/ai-observability/cost", keywords: "spend attribution budget" },
  { label: "Recommendations", hint: "Routing", href: "/ai-observability/recommendations" },
  { label: "Errors", hint: "Errors", href: "/ai-observability/errors" },
  { label: "Models", hint: "Model catalog", href: "/ai-observability/models" },
  { label: "Scores", hint: "Score configs", href: "/ai-observability/scores" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((command) =>
      `${command.label} ${command.hint} ${command.keywords || ""}`.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after the panel paints.
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onListKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      go(results[active].href);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onListKey}
            placeholder="Jump to… (type to filter)"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-auto p-1">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">No matches.</li>
          ) : (
            results.map((command, index) => (
              <li key={command.href}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(command.href)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    index === active ? "bg-primary/10 text-foreground" : "hover:bg-secondary/40"
                  }`}
                >
                  <span>{command.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{command.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
