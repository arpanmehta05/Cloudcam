"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter, CloudIcon } from "@/icons";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import type { CloudProvider } from "@/lib/regions";
import type { ProviderFilter } from "./types";

interface RecFiltersProps {
  providerFilter: ProviderFilter;
  setProviderFilter: (v: ProviderFilter) => void;
  providers: CloudProvider[];
}

export function RecFilters({
  providerFilter,
  setProviderFilter,
  providers,
}: RecFiltersProps) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#0F172A] dark:text-white">
        <Filter className="h-4 w-4 text-[#1A56DB]" />
        Provider scope
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={providerFilter === "all" ? "default" : "outline"}
          onClick={() => setProviderFilter("all")}
        >
          <CloudIcon className="h-3.5 w-3.5" />
          All clouds
        </Button>
        {providers.map((provider) => (
          <Button
            key={provider}
            size="sm"
            variant={providerFilter === provider ? "default" : "outline"}
            onClick={() => setProviderFilter(provider)}
          >
            {getProviderCopy(provider).shortLabel}
          </Button>
        ))}
      </div>
    </Card>
  );
}
