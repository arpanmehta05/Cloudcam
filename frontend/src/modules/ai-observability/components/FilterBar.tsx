"use client";

// ─── AI Observability: Reusable Filter Bar ───
// Displayed across all observability pages for consistent UX.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, RotateCcw, Search } from "@/icons";
import type { DateRange, ProviderFilter, StatusFilter } from "@/hooks/useAiObservabilityFilters";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

const PROVIDERS: { value: ProviderFilter; label: string }[] = [
  { value: "all", label: "All Providers" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
  { value: "bedrock", label: "Bedrock" },
  { value: "nvidia", label: "NVIDIA NIM" },
];

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "timeout", label: "Timeout" },
  { value: "rate_limited", label: "Rate Limited" },
];

interface FilterBarProps {
  dateRange: DateRange;
  onDateRangeChange: (v: DateRange) => void;
  provider?: ProviderFilter;
  onProviderChange?: (v: ProviderFilter) => void;
  status?: StatusFilter;
  onStatusChange?: (v: StatusFilter) => void;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  onExport?: () => void;
  exportLabel?: string;
  onReset?: () => void;
  showProvider?: boolean;
  showStatus?: boolean;
  showSearch?: boolean;
  showExport?: boolean;
  activeFilterCount?: number;
}

export function FilterBar({
  dateRange,
  onDateRangeChange,
  provider = "all",
  onProviderChange,
  status = "all",
  onStatusChange,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  onExport,
  exportLabel = "Export CSV",
  onReset,
  showProvider = true,
  showStatus = false,
  showSearch = true,
  showExport = false,
  activeFilterCount = 0,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap pb-4">
      {/* Date Range Selector */}
      <div className="flex items-center bg-secondary p-1 gap-0.5">
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onDateRangeChange(r.value)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
              dateRange === r.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Provider Filter */}
      {showProvider && onProviderChange && (
        <Select value={provider} onValueChange={(v) => onProviderChange(v as ProviderFilter)}>
          <SelectTrigger className="w-40 h-9 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs font-mono">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status Filter */}
      {showStatus && onStatusChange && (
        <Select value={status} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
          <SelectTrigger className="w-36 h-9 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs font-mono">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Search */}
      {showSearch && onSearchChange && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-8 w-56 text-xs font-mono"
          />
        </div>
      )}

      <div className="flex-1" />

      {/* Active filter count */}
      {activeFilterCount > 0 && (
        <Badge variant="secondary" className="text-[10px] font-mono gap-1">
          <Filter className="w-3 h-3" />
          {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
        </Badge>
      )}

      {/* Reset */}
      {onReset && activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset} className="h-9 text-xs font-mono gap-1">
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      )}

      {/* Export */}
      {showExport && onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="h-9 text-xs font-mono gap-1">
          <Download className="w-3 h-3" />
          {exportLabel}
        </Button>
      )}
    </div>
  );
}
