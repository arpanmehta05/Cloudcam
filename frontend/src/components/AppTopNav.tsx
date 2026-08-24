"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LogOut, Search, Radar } from "@/icons";

import { BrandMark } from "@/components/BrandMark";
import { RegionSelector } from "@/components/RegionSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import {
  searchableNavItems,
  localizeNavItem,
  searchNavItems,
  type PaletteItem,
} from "@/modules/navigation";
import { useRegion } from "@/context/RegionContext";
import { cn } from "@/lib/utils";

export function AppTopNav() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { selectedProvider } = useRegion();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<PaletteItem[]>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const recentStr = localStorage.getItem("rabbittwatch_recent_searches");
      if (recentStr) {
        setRecentSearches(JSON.parse(recentStr));
      }
    } catch (e) {
      console.error("Failed to load recent searches:", e);
    }
  }, []);

  const saveRecentSearch = (item: PaletteItem) => {
    try {
      const recentStr = localStorage.getItem("rabbittwatch_recent_searches");
      let recent: PaletteItem[] = recentStr ? JSON.parse(recentStr) : [];
      recent = recent.filter((r) => r.href !== item.href);
      recent.unshift({ href: item.href, label: item.label, group: item.group });
      recent = recent.slice(0, 5);
      localStorage.setItem(
        "rabbittwatch_recent_searches",
        JSON.stringify(recent),
      );
      setRecentSearches(recent);
    } catch (e) {
      console.error("Failed to save recent search:", e);
    }
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem("rabbittwatch_recent_searches");
      setRecentSearches([]);
    } catch (e) {
      console.error("Failed to clear recent searches:", e);
    }
  };

  const results = useMemo(() => {
    const normalized = query.trim();
    const isAdmin = user?.permissionLevel === "admin";
    const localizedItems = searchableNavItems
      .filter((item) => {
        if (item.systemAdminOnly && !user?.isSystemAdmin) return false;
        if (item.href.includes("tab=team")) return isAdmin;
        return true;
      })
      .map((item) => {
        const localized = localizeNavItem(item, selectedProvider);
        return { ...item, label: localized.label };
      });
    if (!normalized) {
      // No query: surface a few starting points.
      return localizedItems.slice(0, 6).map((item) => ({
        ...item,
        category: item.category || item.group,
        score: 0,
      }));
    }
    return searchNavItems(localizedItems, normalized, 8);
  }, [query, selectedProvider, user?.permissionLevel, user?.isSystemAdmin]);

  const activeItems = useMemo(() => {
    if (query === "" && recentSearches.length > 0) {
      return recentSearches;
    }
    return results;
  }, [query, recentSearches, results]);

  const actionCount = activeItems.length + 1;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const goTo = (href: string) => {
    setQuery("");
    setOpen(false);
    router.push(href);
  };

  const activateIndex = (index: number) => {
    if (index === activeItems.length) {
      goTo("/services");
      return;
    }

    const item = activeItems[index];
    if (item) {
      saveRecentSearch(item);
      goTo(item.href);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <header className="relative z-30 flex h-20 shrink-0 items-center gap-4 border-b border-[#E2E8F0] bg-white px-5 dark:border-[#1E293B] dark:bg-[#050D1A]">
      {/* Mobile Hamburger Toggle */}
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"));
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:border-[#1E293B] dark:text-[#CBD5E1] dark:hover:bg-[#0B1728] dark:hover:text-white md:hidden transition"
        title="Toggle menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-menu"
        >
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      <BrandMark
        href="/dashboard"
        className="min-w-0 md:min-w-[235px]"
        logoClassName="h-12 w-12"
        titleClassName="text-xl"
        subtitleClassName="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#1A56DB]"
      />

      <div className="relative max-w-2xl flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => (current + 1) % actionCount);
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(
                (current) => (current - 1 + actionCount) % actionCount,
              );
            }

            if (event.key === "Enter" && open) {
              event.preventDefault();
              activateIndex(activeIndex);
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls="global-service-search"
          aria-activedescendant={
            open ? `global-service-search-${activeIndex}` : undefined
          }
          placeholder="Search services, features, and settings"
          className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#0F172A] shadow-sm outline-none transition focus:border-[#1A56DB] focus:bg-white focus:ring-4 focus:ring-[#DBEAFE] dark:border-[#24344D] dark:bg-[#07111F] dark:text-white dark:focus:bg-[#0B1728] dark:focus:ring-[#1D4ED8]/30"
        />

        {open && (
          <div
            id="global-service-search"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.16)] dark:border-[#24344D] dark:bg-[#0B1728]"
          >
            {activeItems.length > 0 ? (
              <div className="py-2">
                {query === "" && recentSearches.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#E2E8F0] dark:border-[#24344D] mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
                      Recent Searches
                    </span>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearRecentSearches}
                      className="text-xs font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 transition"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {activeItems.map((item, index) => {
                  const Icon =
                    searchableNavItems.find((n) => n.href === item.href)
                      ?.icon ||
                    item.icon ||
                    Radar;
                  return (
                    <button
                      key={item.href}
                      id={`global-service-search-${index}`}
                      role="option"
                      aria-selected={activeIndex === index}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        saveRecentSearch(item);
                        goTo(item.href);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                        activeIndex === index
                          ? "bg-[#EFF6FF] text-[#1A56DB] dark:bg-[#13233A]"
                          : "hover:bg-[#F8FAFC] dark:hover:bg-[#13233A]",
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#1A56DB]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-[#0F172A] dark:text-white">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                          {item.description || item.group}
                        </span>
                      </span>
                      {item.category && (
                        <span className="hidden shrink-0 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#64748B] dark:bg-[#13233A] dark:text-[#94A3B8] sm:inline">
                          {item.category}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">
                No matches for “{query.trim()}”. Try “ingest key”, “cost”, or
                “traces”.
              </div>
            )}
            <button
              id={`global-service-search-${activeItems.length}`}
              role="option"
              aria-selected={activeIndex === activeItems.length}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(activeItems.length)}
              onClick={() => goTo("/services")}
              className={cn(
                "flex w-full items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-sm font-extrabold text-[#1A56DB] transition dark:border-[#24344D] dark:text-[#6BA3F8]",
                activeIndex === activeItems.length
                  ? "bg-[#EFF6FF] dark:bg-[#13233A]"
                  : "bg-[#F8FAFC] hover:bg-[#EFF6FF] dark:bg-[#07111F] dark:hover:bg-[#13233A]",
              )}
            >
              <span>View all services</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <RegionSelector />
        <ThemeToggle />
        <div className="ml-3 flex h-12 items-center gap-3 rounded-full border border-[#D8E4F8] bg-[#F8FAFC] px-2.5 py-1.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)] dark:border-[#24344D] dark:bg-[#0B1728] dark:shadow-none">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="flex min-w-0 items-center gap-3 rounded-full text-left outline-none transition hover:bg-[#EFF6FF] focus-visible:ring-4 focus-visible:ring-[#DBEAFE] dark:hover:bg-[#13233A] dark:focus-visible:ring-[#1D4ED8]/30"
            title="Open profile"
          >
            <Avatar className="h-9 w-9 shadow-sm ring-2 ring-white dark:ring-[#0B1728]">
              {user?.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user?.name || "User"} />
              ) : null}
              <AvatarFallback className="bg-[#0F172A] text-sm font-extrabold text-white dark:bg-[#1A56DB]">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 pr-1 xl:block">
              <span className="block max-w-[160px] truncate text-sm font-extrabold leading-4 text-[#0F172A] dark:text-white">
                {user?.name || "Sys Admin"}
              </span>
              <span className="flex items-center gap-1.5 mt-0.5">
                <span className="block text-[11px] font-bold leading-3 text-[#1A56DB] dark:text-[#6BA3F8]">
                  Profile
                </span>
                {user?.permissionLevel && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] font-bold rounded-sm uppercase tracking-wide leading-none",
                      user.permissionLevel === "admin" &&
                        "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/50",
                      user.permissionLevel === "operator" &&
                        "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50",
                      user.permissionLevel === "viewer" &&
                        "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-900/50",
                    )}
                  >
                    {user.permissionLevel}
                  </span>
                )}
              </span>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Log out"
            className="h-8 w-8 rounded-full border border-transparent text-[#64748B] hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:text-[#94A3B8] dark:hover:border-[#7F1D1D] dark:hover:bg-[#3B1218] dark:hover:text-[#FCA5A5]"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
