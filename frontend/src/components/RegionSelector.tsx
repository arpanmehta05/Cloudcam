"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, Cloud } from "@/icons";
import { useRegion } from "@/context/RegionContext";
import {
  CLOUD_PROVIDERS,
  getProviderInfo,
  getRegionInfo,
  getGroupedRegions,
  REGION_GROUPS,
  GLOBAL_REGION,
} from "@/lib/regions";
import { Globe } from "@/icons";

export function RegionSelector() {
  const {
    selectedProvider,
    setSelectedProvider,
    selectedRegion,
    setSelectedRegion,
  } = useRegion();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const isGlobal = selectedRegion === GLOBAL_REGION;
  const currentProvider = getProviderInfo(selectedProvider);
  const currentRegion = isGlobal
    ? null
    : getRegionInfo(selectedRegion, selectedProvider);
  const grouped = getGroupedRegions(selectedProvider);

  const updateMenuPosition = useCallback(() => {
    if (typeof window === "undefined" || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 256;
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - menuWidth - 8),
    );
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left,
      width: menuWidth,
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Position and focus the portal menu when it opens.
  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    searchInputRef.current?.focus();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const filteredGroups = REGION_GROUPS.map((group) => ({
    name: group,
    regions: grouped[group].filter(
      (r) =>
        search === "" ||
        r.label.toLowerCase().includes(search.toLowerCase()) ||
        r.value.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((g) => g.regions.length > 0);

  return (
    <div className="relative" ref={triggerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors border border-border text-sm"
      >
        <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-semibold text-foreground text-xs">
          {currentProvider.shortLabel}
        </span>
        {isGlobal ? (
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <span className="text-sm leading-none">
            {currentRegion?.flag || "🌍"}
          </span>
        )}
        <span className="font-medium text-foreground text-xs">
          {isGlobal ? "Global" : currentRegion?.label || selectedRegion}
        </span>
        {!isGlobal && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {selectedRegion}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle || undefined}
            className="z-[1000] overflow-hidden rounded-lg border border-border bg-popover shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
          >
            {/* Search */}
            <div className="p-2 border-b border-border">
              <div className="mb-2 grid grid-cols-3 gap-1 rounded-md bg-secondary p-1">
                {CLOUD_PROVIDERS.map((provider) => {
                  const active = provider.value === selectedProvider;
                  return (
                    <button
                      key={provider.value}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(provider.value);
                        setSearch("");
                      }}
                      className={`rounded px-2 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {provider.shortLabel}
                    </button>
                  );
                })}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search regions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Region List */}
            <div className="max-h-72 overflow-y-auto py-1">
              {/* Global Option */}
              <button
                onClick={() => {
                  setSelectedRegion(GLOBAL_REGION);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors border-b border-border ${
                  isGlobal
                    ? "bg-secondary text-foreground"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 text-left">
                  <span className="font-medium text-[13px]">
                    All {currentProvider.shortLabel} Regions
                  </span>
                </div>
                {isGlobal && (
                  <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                )}
              </button>

              {filteredGroups.map((group) => (
                <div key={group.name}>
                  <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover">
                    {group.name}
                  </div>
                  {group.regions.map((region) => {
                    const isSelected = region.value === selectedRegion;
                    return (
                      <button
                        key={region.value}
                        onClick={() => {
                          setSelectedRegion(region.value);
                          setOpen(false);
                          setSearch("");
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 text-sm transition-colors ${
                          isSelected
                            ? "bg-secondary text-foreground"
                            : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        <span className="text-sm leading-none">
                          {region.flag}
                        </span>
                        <div className="flex-1 text-left">
                          <span className="font-medium text-[13px]">
                            {region.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {region.value}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              {filteredGroups.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No regions match &quot;{search}&quot;
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
