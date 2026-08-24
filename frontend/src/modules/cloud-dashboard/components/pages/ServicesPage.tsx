"use client";

import Link from "next/link";
import { ArrowUpRight, Database, Eye, History, LayoutDashboard, Network, Search, Server, ShieldCheck, Sparkles, TestTube, Pin } from "@/icons";
import { useMemo, useState } from "react";
import { useRegion } from "@/context/RegionContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

import { serviceDirectoryItems, localizeNavItem, searchNavItems } from "@/modules/navigation";

const groupTone: Record<string, string> = {
    Overview: "#1A56DB",
    Compute: "#2563EB",
    Data: "#06B6D4",
    Infrastructure: "#22C55E",
    Compliance: "#14B8A6",
    "AI Observability": "#8B5CF6",
    Operations: "#F97316",
};

const groupIcon = {
    Overview: LayoutDashboard,
    Compute: Server,
    Data: Database,
    Infrastructure: Network,
    Compliance: ShieldCheck,
    "AI Observability": Eye,
    Operations: History,
    Simulation: TestTube,
};

export default function ServicesPage() {
    const [query, setQuery] = useState("");
    const { selectedProvider } = useRegion();
    const { user, updatePinnedServices } = useAuth();

    const pinnedServices = user?.pinnedServices || [
        "/dashboard",
        "/watchdog",
        "/recommendations",
        "/simulations/live-canvas",
        "/vps-logs",
        "/dpdp-compliance",
        "/resize-migration"
    ];

    const togglePin = async (href: string) => {
        if (!updatePinnedServices) return;
        const isPinned = pinnedServices.includes(href);
        const newPinned = isPinned
            ? pinnedServices.filter((h) => h !== href)
            : [...pinnedServices, href];
        try {
            await updatePinnedServices(newPinned);
        } catch (err) {
            console.error("Failed to toggle pin:", err);
        }
    };

    const filteredItems = useMemo(() => {
        const localized = serviceDirectoryItems
            .filter((item) => !item.systemAdminOnly || user?.isSystemAdmin)
            .map(item => {
                const localizedItem = localizeNavItem(item, selectedProvider);
                return { ...item, label: localizedItem.label };
            });
        if (!query.trim()) return localized;
        // Rank with the shared engine, then keep only the matched items so the
        // browse view stays grouped by category instead of a flat ranked list.
        const matchedHrefs = new Set(
            searchNavItems(localized, query, localized.length).map((r) => r.href),
        );
        return localized.filter((item) => matchedHrefs.has(item.href));
    }, [query, selectedProvider, user?.isSystemAdmin]);

    const grouped = useMemo(() => {
        return filteredItems.reduce<Record<string, typeof serviceDirectoryItems>>((acc, item) => {
            acc[item.group] = acc[item.group] || [];
            acc[item.group].push(item);
            return acc;
        }, {});
    }, [filteredItems]);

    return (
        <div className="space-y-5">
            <header className="rounded-lg border border-[#E2E8F0] bg-white/88 p-5 shadow-sm backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/88">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-xs font-extrabold text-[#1A56DB] shadow-sm dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                            <Sparkles className="h-3.5 w-3.5" />
                            CloudWatcher service map
                        </div>
                        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#020617] dark:text-white">
                            All services
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
                            Overview, Watchdog, AWS services, AI observability, settings, and operations in one command directory.
                        </p>
                    </div>

                    <div className="relative w-full max-w-xl">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search overview, watchdog, EC2, AI setup..."
                            className="h-12 w-full rounded-lg border border-[#CBD5E1] bg-white pl-10 pr-3 text-sm font-bold text-[#0F172A] shadow-sm outline-none transition focus:border-[#1A56DB] focus:ring-4 focus:ring-[#DBEAFE] dark:border-[#24344D] dark:bg-[#0B1728] dark:text-white dark:focus:ring-[#1D4ED8]/30"
                        />
                    </div>
                </div>
            </header>

            <div className="grid gap-5 2xl:grid-cols-2">
                {Object.entries(grouped).map(([group, items]) => {
                    const accent = groupTone[group] || "#1A56DB";
                    const GroupIcon = groupIcon[group as keyof typeof groupIcon] || LayoutDashboard;
                    return (
                        <section key={group} className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0B1728]">
                            <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 dark:border-[#1E293B] dark:bg-[#07111F]">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center" style={{ color: accent }}>
                                        <GroupIcon className="h-7 w-7 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#0F172A] dark:text-white">{group}</h2>
                                        <p className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{items.length} destinations</p>
                                    </div>
                                </div>
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                            </div>

                            <div className="grid gap-3 p-4 lg:grid-cols-2">
                                {items.map((item) => {
                                    const Icon = item.icon;
                                    const isPinned = pinnedServices.includes(item.href);
                                    const isDisabled = item.href.startsWith("/saas-admin");
                                    const CardContent = (
                                        <>
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ color: accent }}>
                                                <Icon className="h-7 w-7 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="block truncate text-sm font-extrabold text-[#0F172A] dark:text-white">{item.label}</span>
                                                    {isDisabled && (
                                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-[#64748B] dark:bg-[#10213A] dark:text-[#94A3B8]">
                                                            Coming soon
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="mt-1 block truncate text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{item.href}</span>
                                            </span>
                                            {!isDisabled && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        togglePin(item.href);
                                                    }}
                                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition shrink-0"
                                                    title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
                                                >
                                                    <Pin
                                                        className={cn(
                                                            "h-4 w-4 transition-all duration-200",
                                                            isPinned
                                                                ? "text-blue-600 fill-blue-600 dark:text-[#6BA3F8] dark:fill-[#6BA3F8] scale-110"
                                                                : "text-[#94A3B8] hover:text-slate-600 dark:hover:text-slate-300"
                                                        )}
                                                    />
                                                </button>
                                            )}
                                        </>
                                    );

                                    if (isDisabled) {
                                        return (
                                            <div
                                                key={item.href}
                                                className="flex min-h-[88px] items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 opacity-60 cursor-not-allowed dark:border-[#24344D] dark:bg-[#07111F]"
                                            >
                                                {CardContent}
                                            </div>
                                        );
                                    }

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className="group flex min-h-[88px] items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 transition hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:bg-white hover:shadow-[0_14px_34px_rgba(26,86,219,0.10)] dark:border-[#24344D] dark:bg-[#07111F] dark:hover:border-[#1D4ED8] dark:hover:bg-[#0B1728]"
                                        >
                                            {CardContent}
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
