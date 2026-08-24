"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "@/icons";
import { RegionSelector } from "@/components/RegionSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LivePulse } from "@/components/LivePulse";

interface HeaderProps {
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  onRefresh: () => void;
  onAutoRefresh?: () => void;
  isLoading: boolean;
  lastUpdated: string;
  refreshIntervalSeconds?: number;
  showRegionSelector?: boolean;
  showTimeRange?: boolean;
  showAutoRefresh?: boolean;
  showRefresh?: boolean;
}

const timeRanges = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];

export function DashboardHeader({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  onAutoRefresh,
  isLoading,
  lastUpdated,
  refreshIntervalSeconds = 60,
  showRegionSelector = true,
  showTimeRange = true,
  showAutoRefresh = true,
  showRefresh = true,
}: HeaderProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(refreshIntervalSeconds);
  const refreshRef = useRef(onRefresh);
  const autoRefreshRef = useRef(onAutoRefresh || onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    autoRefreshRef.current = onAutoRefresh || onRefresh;
  }, [onAutoRefresh, onRefresh]);

  useEffect(() => {
    setCountdown(refreshIntervalSeconds);
  }, [refreshIntervalSeconds, timeRange]);

  useEffect(() => {
    if (!autoRefresh || !showAutoRefresh) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTimeout(() => autoRefreshRef.current(), 0);
          return refreshIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshIntervalSeconds, showAutoRefresh]);

  const handleManualRefresh = () => {
    setCountdown(refreshIntervalSeconds);
    refreshRef.current();
  };

  return (
    <header className="mb-6 flex flex-col gap-4 rounded-lg border border-[#E2E8F0] bg-white/85 px-4 py-4 shadow-sm backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/88 lg:flex-row lg:items-center lg:justify-between">
      {/* Left */}
      <div className="flex items-center gap-4">
        <LivePulse />
        {showRegionSelector && <RegionSelector />}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Time Range */}
        {showTimeRange && (
          <div className="flex items-center rounded-lg border border-[#CBD5E1] bg-white p-1 shadow-sm dark:border-[#334155] dark:bg-[#0B1728]">
            {timeRanges.map((tr) => (
              <button
                key={tr.value}
                onClick={() => onTimeRangeChange(tr.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === tr.value
                    ? "bg-[#1A56DB] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#1A56DB] dark:text-[#94A3B8] dark:hover:bg-[#13233A] dark:hover:text-white"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        )}

        {/* Auto-refresh */}
        {showAutoRefresh && (
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh
                ? "border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1728] dark:text-white"
                : "text-[#64748B] dark:text-[#94A3B8]"
            }`}
          >
            <Clock className="w-4 h-4" />
            {autoRefresh ? `${countdown}s` : "Off"}
          </button>
        )}

        {/* Refresh */}
        {showRefresh && (
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="h-10 px-4 text-sm"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        )}

        {/* Last Updated */}
        {lastUpdated && (
          <span className="mr-3 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#64748B] dark:border-[#334155] dark:bg-[#0B1728] dark:text-[#94A3B8]">
            {lastUpdated}
          </span>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
