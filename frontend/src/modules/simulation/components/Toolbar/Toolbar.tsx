"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  X,
  Plus,
  Server,
  HardDrive,
  Database,
  Zap,
  Cloud,
  Github,
  Network,
  Container,
  Boxes,
  Gauge,
  Shield,
  Globe,
} from "@/icons";
import { Input } from "@/components/ui/input";
import { filterServices, serviceRegistry, type ServiceDefinition } from "../../registry";

export function SearchResultItem({
  def,
  index,
  isHighlighted,
  onHover,
  onSelect,
}: {
  def: (typeof serviceRegistry)[number];
  index: number;
  isHighlighted: boolean;
  onHover: () => void;
  onSelect: (id: string) => void;
}) {
  const colors = {
    bg: "bg-[#F8FAFC] dark:bg-[#0F172A]",
    text: "text-[#64748B] dark:text-[#94A3B8]",
    border: "ring-[#E2E8F0] dark:ring-[#1E293B]",
  };

  const IconMap: Record<string, any> = {
    Server,
    HardDrive,
    Database,
    Zap,
    Cloud,
    Github,
    Network,
    Container,
    Boxes,
    Gauge,
    Shield,
    Globe,
  };
  const Icon = IconMap[def.icon] || Server;

  return (
    <button
      type="button"
      data-search-index={index}
      onMouseEnter={onHover}
      onClick={() => onSelect(def.id)}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isHighlighted ? "bg-[#F8FAFC] dark:bg-[#13233A]" : "hover:bg-[#F8FAFC] dark:hover:bg-[#13233A]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 shadow-sm ${colors.bg} ${colors.text} ${colors.border}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-[#0F172A] dark:text-white">
          {def.label}
          <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {def.provider}
          </span>
        </p>
        <p className="truncate text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{def.description}</p>
      </div>
      <Plus
        className={`h-4 w-4 shrink-0 transition-colors ${
          isHighlighted
            ? "text-[#1A56DB] dark:text-[#6BA3F8]"
            : "text-[#94A3B8] group-hover:text-[#1A56DB] dark:group-hover:text-[#6BA3F8]"
        }`}
      />
    </button>
  );
}

interface ServiceSearchProps {
  onAdd: (serviceId: string) => void;
  provider: ServiceDefinition["provider"];
}

export function ServiceSearch({ onAdd, provider }: ServiceSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => filterServices(query, provider), [query, provider]);

  useEffect(() => {
    setHighlightIndex((i) => {
      if (results.length === 0) return 0;
      return Math.min(i, results.length - 1);
    });
  }, [results]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: globalThis.MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }

    // Use capture phase so ReactFlow's handlers don't swallow it
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (serviceId: string) => {
      onAdd(serviceId);
      setQuery("");
      setIsOpen(false);
    },
    [onAdd],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }

      if (!isOpen || results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % results.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + results.length) % results.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const pick = results[highlightIndex];
        if (pick) handleSelect(pick.id);
      }
    },
    [results, handleSelect, isOpen, highlightIndex],
  );

  useEffect(() => {
    if (!isOpen || results.length === 0 || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-search-index="${highlightIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, isOpen, results.length]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <label htmlFor="service-search-input" className="sr-only">Search services</label>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            id="service-search-input"
            name="service-search"
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${provider.toUpperCase()} services...`}
            className="h-12 w-full rounded-lg border border-[#CBD5E1] bg-white/95 pl-10 pr-8 text-sm font-bold text-[#0F172A] shadow-sm backdrop-blur-sm transition focus:border-[#1A56DB] focus:ring-4 focus:ring-[#DBEAFE] dark:border-[#24344D] dark:bg-[#0B1728]/95 dark:text-white dark:focus:ring-[#1D4ED8]/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick-add button for all services */}
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setIsOpen((v) => !v);
            inputRef.current?.focus();
          }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white/95 shadow-sm backdrop-blur-sm transition hover:bg-[#F8FAFC] dark:border-[#24344D] dark:bg-[#0B1728]/95 dark:hover:bg-[#13233A]"
        >
          <Plus className="h-5 w-5 text-[#0F172A] dark:text-white" />
        </button>
      </div>

      {/* Dropdown results */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-9999 mt-2 max-h-72 overflow-auto rounded-xl border border-[#E2E8F0] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#0B1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
          >
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
                No services match&ensp;
                <span className="font-extrabold text-[#0F172A] dark:text-white">&ldquo;{query}&rdquo;</span>
              </div>
            ) : (
              <div ref={listRef} className="py-2">
                {results.map((def, index) => (
                  <SearchResultItem
                    key={def.id}
                    def={def}
                    index={index}
                    isHighlighted={index === highlightIndex}
                    onHover={() => setHighlightIndex(index)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Export as default or Toolbar name to satisfy checklist/plan
export { ServiceSearch as Toolbar };
