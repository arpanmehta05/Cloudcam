"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "@/icons";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { docsGroups, docsPages } from "@/lib/docs-content";
import { useDocsOpenGroups, useDocsSidebarScroll } from "@/components/docs/DocsStateProvider.client";

const BRAND_NAME = "CloudWatcher";

function DocsNavPanel() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useDocsOpenGroups();

  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return docsGroups;

    return docsGroups
      .map((group) => ({
        ...group,
        pages: group.pages.filter((page) => {
          const fullPage = docsPages.find((candidate) => candidate.path === page.path);
          const haystack = [
            group.title,
            page.label,
            page.title,
            ...(fullPage?.sections.map((section) => section.title) || []),
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.pages.length > 0);
  }, [normalizedQuery]);

  const totalResults = filteredGroups.reduce((sum, group) => sum + group.pages.length, 0);

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups((current) => ({ ...current, [groupTitle]: !current[groupTitle] }));
  };

  return (
    <nav aria-label="Documentation navigation" className="flex h-full flex-col">
      <div className="pb-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8] dark:text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs"
            className="h-10 rounded-[12px] border border-transparent bg-transparent pl-7 pr-0 text-sm shadow-none focus-visible:border-[#BFDBFE] dark:focus-visible:border-slate-700 focus-visible:ring-0"
          />
        </div>
        {normalizedQuery ? (
          <p className="pt-2 text-xs text-[#64748B] dark:text-slate-400">
            {totalResults} result{totalResults === 1 ? "" : "s"} for "{query}"
          </p>
        ) : null}
      </div>

      <ul className="space-y-5">
        {filteredGroups.map((group) => {
          const isOpen = openGroups[group.title] ?? true;

          return (
            <li key={group.title}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between py-1 text-left text-xs font-bold uppercase tracking-[0.14em] text-[#64748B] dark:text-slate-400 transition-all duration-200 ease-out hover:translate-x-0.5 hover:text-[#1A56DB] dark:hover:text-primary"
              >
                <span>{group.title}</span>
                <span className="text-sm font-semibold text-[#94A3B8] dark:text-slate-500">{isOpen ? "-" : "+"}</span>
              </button>

              {isOpen ? (
                <ul className="mt-2 border-l border-[#E2E8F0] dark:border-slate-800">
                  {group.pages.map((page) => {
                    const active = pathname === page.path;
                    return (
                      <li key={page.path}>
                        <Link
                          href={page.path}
                          aria-current={active ? "page" : undefined}
                          className={`relative block py-2 pl-4 pr-2 text-sm transition-all duration-200 ease-out ${
                            active
                              ? "font-semibold text-[#1A56DB] dark:text-primary before:absolute before:-left-px before:top-2 before:h-5 before:w-0.5 before:bg-[#1A56DB] dark:before:bg-primary"
                              : "text-[#475569] dark:text-slate-300 hover:translate-x-0.5 hover:bg-[#F3F7FD] dark:hover:bg-slate-800/40 hover:text-[#0F172A] dark:hover:text-white"
                          }`}
                        >
                          {page.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}

        {filteredGroups.length === 0 ? (
          <li className="pt-2 text-sm leading-6 text-[#64748B] dark:text-slate-400">
            No matching docs. Try `Azure`, `GCP`, `billing`, `AI`, `migration`, or `troubleshooting`.
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export function DocsDesktopNav() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useDocsSidebarScroll();
  const initialScrollTop = useRef(scrollTop);

  useEffect(() => {
    const nav = scrollRef.current;
    if (!nav) return;

    if (initialScrollTop.current > 0) {
      nav.scrollTop = initialScrollTop.current;
    }

    const saveScroll = () => {
      setScrollTop(nav.scrollTop);
    };

    nav.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      saveScroll();
      nav.removeEventListener("scroll", saveScroll);
    };
  }, [setScrollTop]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-8 pb-20 pt-8">
      <DocsNavPanel />
    </div>
  );
}

export function DocsMobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 rounded-[12px] border-[#D8E1F0] dark:border-slate-800 bg-white dark:bg-[#0B1728] text-[#0F172A] dark:text-slate-200 shadow-none lg:hidden">
          Browse docs
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-none border-r border-[#E8EDF5] dark:border-slate-800 bg-white dark:bg-[#07111F] p-5" showCloseButton>
        <SheetHeader className="p-0 pb-4">
          <SheetTitle className="text-left text-xl font-extrabold tracking-tight text-[#1A56DB] dark:text-primary">{BRAND_NAME} Docs</SheetTitle>
          <SheetDescription className="text-left text-[#64748B] dark:text-slate-400">Browse setup guides, troubleshooting, and product usage docs.</SheetDescription>
        </SheetHeader>
        <DocsNavPanel />
      </SheetContent>
    </Sheet>
  );
}
