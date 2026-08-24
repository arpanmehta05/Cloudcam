"use client";

// ─── AI Observability: Shared Filter State ───
// Custom hook managing filter state across all observability pages.

import { useState, useCallback, useMemo } from "react";

export type DateRange = "24h" | "7d" | "30d" | "90d";
export type ProviderFilter = "all" | "openai" | "gemini" | "anthropic" | "bedrock" | "nvidia";
export type StatusFilter = "all" | "success" | "error" | "timeout" | "rate_limited";

export interface AiObservabilityFilters {
    dateRange: DateRange;
    provider: ProviderFilter;
    status: StatusFilter;
    search: string;
}

export function useAiObservabilityFilters(defaults?: Partial<AiObservabilityFilters>) {
    const [dateRange, setDateRange] = useState<DateRange>(defaults?.dateRange || "7d");
    const [provider, setProvider] = useState<ProviderFilter>(defaults?.provider || "all");
    const [status, setStatus] = useState<StatusFilter>(defaults?.status || "all");
    const [search, setSearch] = useState(defaults?.search || "");

    const reset = useCallback(() => {
        setDateRange(defaults?.dateRange || "7d");
        setProvider(defaults?.provider || "all");
        setStatus(defaults?.status || "all");
        setSearch(defaults?.search || "");
    }, [defaults]);

    /** Construct query string params for API calls. */
    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set("range", dateRange);
        if (provider !== "all") params.set("provider", provider);
        if (status !== "all") params.set("status", status);
        return params.toString();
    }, [dateRange, provider, status]);

    const filters = useMemo<AiObservabilityFilters>(() => ({
        dateRange,
        provider,
        status,
        search,
    }), [dateRange, provider, status, search]);

    return {
        filters,
        dateRange, setDateRange,
        provider, setProvider,
        status, setStatus,
        search, setSearch,
        queryParams,
        reset,
    };
}
