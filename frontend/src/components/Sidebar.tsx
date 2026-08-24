"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Grid3X3,
  X,
  Pencil,
} from "@/icons";

import { cn } from "@/lib/utils";
import {
  getRelatedNavItems,
  getSidebarSections,
  getSidebarTitle,
  searchableNavItems,
  localizeNavItem,
  type NavItem,
} from "@/modules/navigation";
import { useRegion } from "@/context/RegionContext";
import { useAuth } from "@/context/AuthContext";

const SIDEBAR_COLLAPSED_KEY = "cloudwatcher.sidebar.collapsed";
const SIDEBAR_SECTION_KEY = "cloudwatcher.sidebar.sections";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedProvider } = useRegion();
  const { user, updatePinnedServices } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [isEditingSidebar, setIsEditingSidebar] = useState(false);
  const [editingPins, setEditingPins] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = getSidebarTitle(pathname, selectedProvider);
  const rawSections = useMemo(
    () => getSidebarSections(pathname, selectedProvider),
    [pathname, selectedProvider],
  );

  const sections = useMemo(() => {
    const isAdmin = user?.permissionLevel === "admin";
    return rawSections.map((section) => {
      let items = section.items;

      // If this is the main sidebar section (labeled "Overview"),
      // populate it with the user's custom pinned services if available
      if (section.label === "Overview") {
        const pinned = user?.pinnedServices;
        if (pinned && Array.isArray(pinned)) {
          items = pinned
            .map((href) => {
              const rawItem = searchableNavItems.find((i) => i.href === href);
              if (!rawItem) return null;
              return localizeNavItem(rawItem, selectedProvider);
            })
            .filter((item): item is NavItem => item !== null);
        }
      }

      const isEditable = section.label === "Overview";

      return {
        ...section,
        label: section.label,
        isEditable,
        items: items.filter((item) => {
          if (item.href.includes("tab=team")) {
            return isAdmin;
          }
          return true;
        }),
      };
    });
  }, [
    rawSections,
    user?.pinnedServices,
    user?.permissionLevel,
    selectedProvider,
  ]);

  // Track active item with query parameters support
  const isItemActive = (itemHref: string) => {
    const [itemPath, itemQuery] = itemHref.split("?");

    const isPrefixMatch =
      itemPath !== "/dashboard" &&
      itemPath !== "/ai-observability" &&
      pathname.startsWith(`${itemPath}/`) &&
      !(
        itemPath === "/simulations" &&
        pathname.startsWith("/simulations/live-canvas")
      );

    // On a prefix match, stay active only if no more-specific sibling route (a
    // longer registered href in the same subtree) also matches the path.
    const hasMoreSpecificMatch =
      isPrefixMatch &&
      searchableNavItems.some((other) => {
        const otherPath = other.href.split("?")[0];
        return (
          otherPath.length > itemPath.length &&
          otherPath.startsWith(`${itemPath}/`) &&
          (pathname === otherPath || pathname.startsWith(`${otherPath}/`))
        );
      });

    const pathMatches =
      pathname === itemPath || (isPrefixMatch && !hasMoreSpecificMatch);

    if (!pathMatches) return false;

    if (itemQuery) {
      const params = new URLSearchParams(itemQuery);
      for (const [key, value] of params.entries()) {
        if (searchParams.get(key) !== value) {
          return false;
        }
      }
    }
    return true;
  };

  // Mobile-friendly touchscreen pin reordering
  const handleMovePin = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editingPins.length) return;

    setEditingPins((current) => {
      const copy = [...current];
      const temp = copy[index];
      copy[index] = copy[newIndex];
      copy[newIndex] = temp;
      return copy;
    });
  };

  const startEditing = () => {
    const currentPins = user?.pinnedServices || [
      "/dashboard",
      "/watchdog",
      "/recommendations",
      "/simulations/live-canvas",
      "/vps-logs",
      "/resize-migration",
    ];
    setEditingPins(currentPins);
    setIsEditingSidebar(true);
  };

  const handleRemovePinLocally = (href: string) => {
    setEditingPins((current) => current.filter((h) => h !== href));
  };

  const handleSaveSidebar = async () => {
    if (!updatePinnedServices) return;
    try {
      await updatePinnedServices(editingPins);
      setIsEditingSidebar(false);
    } catch (err) {
      console.error("Failed to save sidebar config:", err);
    }
  };

  const handleCancelSidebar = () => {
    setIsEditingSidebar(false);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    setEditingPins((current) => {
      const copy = [...current];
      const temp = copy[draggedIndex];
      copy.splice(draggedIndex, 1);
      copy.splice(index, 0, temp);
      return copy;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const editItems = useMemo(() => {
    return editingPins
      .map((href) => {
        const rawItem = searchableNavItems.find((i) => i.href === href);
        if (!rawItem) return null;
        return localizeNavItem(rawItem, selectedProvider);
      })
      .filter((item): item is NavItem => item !== null);
  }, [editingPins, selectedProvider]);

  const handleUnpin = async (href: string) => {
    if (!updatePinnedServices || !user) return;
    const pinned = user.pinnedServices || [
      "/dashboard",
      "/watchdog",
      "/recommendations",
      "/simulations/live-canvas",
      "/vps-logs",
      "/resize-migration",
    ];
    const newPinned = pinned.filter((h) => h !== href);
    try {
      await updatePinnedServices(newPinned);
    } catch (err) {
      console.error("Failed to unpin service:", err);
    }
  };

  const relatedItems = getRelatedNavItems(pathname).slice(0, 4);

  // Sync mobile sidebar toggles
  useEffect(() => {
    const handleToggle = () => {
      setMobileOpen((prev) => !prev);
    };
    window.addEventListener("toggle-mobile-sidebar", handleToggle);
    return () => {
      window.removeEventListener("toggle-mobile-sidebar", handleToggle);
    };
  }, []);

  // Close mobile menu and edit mode on page transitions
  useEffect(() => {
    setMobileOpen(false);
    setIsEditingSidebar(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (collapsed) {
      setIsEditingSidebar(false);
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
      );
      const savedSections = window.localStorage.getItem(SIDEBAR_SECTION_KEY);
      setOpenSections(savedSections ? JSON.parse(savedSections) : {});
    } catch {
      setOpenSections({});
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      SIDEBAR_SECTION_KEY,
      JSON.stringify(openSections),
    );
  }, [openSections, hydrated]);

  const isOpen = (label: string, defaultOpen = false) =>
    openSections[label] ?? defaultOpen;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-full shrink-0 border-r border-[#D8DEE8] bg-white transition-all duration-300 ease-in-out dark:border-[#1E293B] dark:bg-[#050D1A] md:relative md:translate-x-0 md:z-20 md:flex flex-col",
          collapsed ? "w-[72px]" : "w-[292px]",
          mobileOpen
            ? "translate-x-0 w-[292px] shadow-2xl"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div
            className={cn(
              "flex h-16 items-center border-b border-[#E2E8F0] px-4 dark:border-[#1E293B]",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            {!collapsed ? (
              <h2 className="truncate text-xl font-extrabold tracking-tight text-[#020617] dark:text-white">
                {title}
              </h2>
            ) : null}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#475569] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:text-[#CBD5E1] dark:hover:bg-[#0B1728] dark:hover:text-white"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>

          {collapsed ? (
            <nav
              className="flex-1 overflow-y-auto px-3 py-4 animate-in fade-in duration-200"
              key={title}
            >
              <div className="space-y-2">
                {/* "Back to Overview" icon at the top when collapsed */}
                {title !== "CloudWatcher" && (
                  <Link
                    href="/dashboard"
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#64748B] hover:border-blue-300 hover:bg-blue-50 hover:text-[#1A56DB] dark:border-slate-800 dark:bg-[#07111F]/50 dark:text-[#CBD5E1] dark:hover:border-blue-950/40 dark:hover:text-[#6BA3F8] transition duration-200 mb-3 hover:-translate-x-0.5"
                    title="Back to Overview"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Link>
                )}

                {sections
                  .flatMap((section) => section.items)
                  .slice(0, 12)
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.href);
                    const external = item.href.startsWith("http");
                    const className = cn(
                      "flex h-11 w-11 items-center justify-center rounded-lg border transition",
                      active
                        ? "border-[#DBEAFE] bg-[#EFF6FF] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]"
                        : "border-transparent text-[#64748B] hover:border-[#E2E8F0] hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-[#CBD5E1] dark:hover:border-[#24344D] dark:hover:bg-[#0B1728] dark:hover:text-white",
                    );

                    return external ? (
                      <a
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className={className}
                        title={item.label}
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    ) : (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        className={className}
                        title={item.label}
                      >
                        <Icon className="h-5 w-5" />
                      </Link>
                    );
                  })}

                {/* Appended "View all services" icon when collapsed */}
                <Link
                  href="/services"
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg border transition",
                    pathname === "/services"
                      ? "border-[#DBEAFE] bg-[#EFF6FF] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]"
                      : "border-transparent text-blue-600 hover:border-[#E2E8F0] hover:bg-[#F8FAFC] dark:text-blue-400 dark:hover:border-[#24344D] dark:hover:bg-[#0B1728] dark:hover:text-white",
                  )}
                  title="View all services"
                >
                  <Grid3X3 className="h-5 w-5 text-blue-500" />
                </Link>
              </div>
            </nav>
          ) : (
            <nav
              className="flex-1 overflow-y-auto px-4 py-4 animate-in fade-in duration-200"
              key={title}
            >
              <div className="space-y-5">
                {/* "Back to Overview" link at the top of items */}
                {title !== "CloudWatcher" && (
                  <Link
                    href="/dashboard"
                    className="mb-4 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs font-bold text-[#64748B] hover:border-blue-200 hover:bg-blue-50/30 hover:text-[#1A56DB] dark:border-slate-800/50 dark:bg-slate-900/20 dark:text-[#CBD5E1] dark:hover:border-blue-900/50 dark:hover:bg-blue-950/20 dark:hover:text-[#6BA3F8] transition duration-200 group"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                    <span>Back to Overview</span>
                  </Link>
                )}

                {sections.map((section) => {
                  const open = isOpen(section.label, section.defaultOpen);
                  return (
                    <div key={section.label}>
                      <div className="group/header mb-1 flex w-full items-center justify-between rounded-lg px-1 py-1 text-base font-extrabold text-[#020617] dark:text-white">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSections((current) => ({
                              ...current,
                              [section.label]: !open,
                            }))
                          }
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform",
                              open ? "rotate-0" : "-rotate-90",
                            )}
                          />
                          <span className="truncate">{section.label}</span>
                        </button>

                        {open && section.isEditable && !isEditingSidebar && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startEditing();
                            }}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-[#6BA3F8] dark:hover:text-blue-400 px-2 py-0.5 rounded transition shrink-0"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        )}
                      </div>

                      {open ? (
                        <ul className="space-y-0.5 pl-7">
                          {(section.isEditable && isEditingSidebar
                            ? editItems
                            : section.items
                          ).map((item, index) => {
                            const Icon = item.icon;
                            const external = item.href.startsWith("http");
                            const active = isItemActive(item.href);
                            const isOverviewSection = section.isEditable;
                            const className = cn(
                              "group flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-[15px] font-semibold transition w-full text-left",
                              active
                                ? "bg-[#EFF6FF] text-[#1A56DB] dark:bg-[#10213A] dark:text-[#6BA3F8]"
                                : "text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-[#CBD5E1] dark:hover:bg-[#0B1728] dark:hover:text-white",
                              isEditingSidebar &&
                                isOverviewSection &&
                                "cursor-grab active:cursor-grabbing select-none",
                            );

                            const ItemWrapper = isEditingSidebar ? "div" : Link;
                            const itemProps = isEditingSidebar
                              ? { className }
                              : { href: item.href, className };

                            return (
                              <li
                                key={`${section.label}-${item.href}-${item.label}`}
                                className={cn(
                                  "group relative",
                                  isEditingSidebar &&
                                    isOverviewSection &&
                                    draggedIndex === index &&
                                    "opacity-40 scale-95 transition-all",
                                )}
                                draggable={
                                  isEditingSidebar && isOverviewSection
                                }
                                onDragStart={() =>
                                  isEditingSidebar &&
                                  isOverviewSection &&
                                  handleDragStart(index)
                                }
                                onDragEnter={() =>
                                  isEditingSidebar &&
                                  isOverviewSection &&
                                  handleDragEnter(index)
                                }
                                onDragEnd={() =>
                                  isEditingSidebar &&
                                  isOverviewSection &&
                                  handleDragEnd()
                                }
                                onDragOver={(e) => e.preventDefault()}
                              >
                                {external && !isEditingSidebar ? (
                                  <a
                                    href={item.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={className}
                                  >
                                    <Icon
                                      className={cn(
                                        "h-4 w-4 shrink-0 transition-colors duration-150",
                                        active
                                          ? "text-[#1A56DB] dark:text-[#6BA3F8]"
                                          : "text-[#94A3B8] group-hover:text-[#1A56DB] dark:group-hover:text-white",
                                      )}
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                      {item.label}
                                    </span>
                                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
                                  </a>
                                ) : (
                                  // @ts-ignore
                                  <ItemWrapper {...itemProps}>
                                    {isEditingSidebar && isOverviewSection && (
                                      <div className="flex items-center gap-0.5 mr-1 shrink-0">
                                        <div
                                          className="text-[#94A3B8] cursor-grab active:cursor-grabbing select-none"
                                          title="Drag to reorder"
                                        >
                                          <svg
                                            width="8"
                                            height="12"
                                            viewBox="0 0 8 12"
                                            className="fill-current"
                                          >
                                            <circle cx="2" cy="2" r="1" />
                                            <circle cx="2" cy="6" r="1" />
                                            <circle cx="2" cy="10" r="1" />
                                            <circle cx="6" cy="2" r="1" />
                                            <circle cx="6" cy="6" r="1" />
                                            <circle cx="6" cy="10" r="1" />
                                          </svg>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMovePin(index, -1);
                                          }}
                                          disabled={index === 0}
                                          className="p-0.5 text-[#94A3B8] hover:text-[#1A56DB] dark:hover:text-[#6BA3F8] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                          title="Move Up"
                                        >
                                          <ChevronUp className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMovePin(index, 1);
                                          }}
                                          disabled={
                                            index === editItems.length - 1
                                          }
                                          className="p-0.5 text-[#94A3B8] hover:text-[#1A56DB] dark:hover:text-[#6BA3F8] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                          title="Move Down"
                                        >
                                          <ChevronDown className="h-3 w-3" />
                                        </button>
                                      </div>
                                    )}
                                    <Icon
                                      className={cn(
                                        "h-4 w-4 shrink-0 transition-colors duration-150",
                                        active
                                          ? "text-[#1A56DB] dark:text-[#6BA3F8]"
                                          : "text-[#94A3B8] group-hover:text-[#1A56DB] dark:group-hover:text-white",
                                      )}
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                      {item.label}
                                    </span>
                                    {isEditingSidebar && isOverviewSection && (
                                      <button
                                        type="button"
                                        draggable={false}
                                        onDragStart={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleRemovePinLocally(item.href);
                                        }}
                                        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0 border-none cursor-pointer"
                                        title="Remove pin"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </ItemWrapper>
                                )}
                              </li>
                            );
                          })}

                          {/* Appended "View all services" quick-link at the bottom of the section */}
                          {section.isEditable && !isEditingSidebar && (
                            <li>
                              <Link
                                href="/services"
                                className={cn(
                                  "group flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-[15px] font-bold transition",
                                  pathname === "/services"
                                    ? "bg-[#EFF6FF] text-[#1A56DB] dark:bg-[#10213A] dark:text-[#6BA3F8]"
                                    : "text-blue-600 hover:bg-[#F8FAFC] dark:text-blue-400 dark:hover:bg-[#0B1728] dark:hover:text-white",
                                )}
                              >
                                <Grid3X3 className="h-4 w-4 shrink-0 text-blue-500 group-hover:text-blue-600" />
                                <span className="min-w-0 flex-1 truncate">
                                  View all services
                                </span>
                              </Link>
                            </li>
                          )}

                          {/* Save and Cancel buttons shown in edit mode */}
                          {section.isEditable && isEditingSidebar && (
                            <li>
                              <div className="flex items-center justify-end gap-2 px-2 py-2 mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-3">
                                <button
                                  type="button"
                                  onClick={handleCancelSidebar}
                                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A] dark:border-slate-800 dark:bg-slate-900/50 dark:text-[#CBD5E1] dark:hover:bg-slate-850 dark:hover:text-white transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveSidebar}
                                  className="rounded bg-blue-600 px-3 py-1 text-xs font-extrabold text-white hover:bg-blue-700 dark:bg-[#1D4ED8] dark:hover:bg-[#1e40af] transition cursor-pointer shadow-sm"
                                >
                                  Save
                                </button>
                              </div>
                            </li>
                          )}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}

                {relatedItems.length > 0 ? (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#24344D] dark:bg-[#07111F]">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#64748B] dark:text-[#94A3B8]">
                        Related services
                      </h3>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#94A3B8]" />
                    </div>
                    <div className="space-y-1">
                      {relatedItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="group flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-[#475569] transition hover:bg-white hover:text-[#1A56DB] dark:text-[#CBD5E1] dark:hover:bg-[#0B1728] dark:hover:text-[#6BA3F8]"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-[#94A3B8] group-hover:text-[#1A56DB]" />
                            <span className="min-w-0 flex-1 truncate">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </nav>
          )}
        </div>
      </aside>
    </>
  );
}
