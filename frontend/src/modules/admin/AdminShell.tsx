"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Layers,
  Building2,
  History,
  ShieldCheck,
  User,
  LogOut,
} from "@/icons";
import type { LucideIcon } from "@/icons";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const MANAGE: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, description: "Revenue and tenant health" },
  { href: "/admin/plans", label: "Plans", icon: Layers, description: "Packaging and limits" },
  { href: "/admin/tenants", label: "Tenants", icon: Building2, description: "Access and overrides" },
];
const SYSTEM: NavItem[] = [
  { href: "/admin/audit", label: "Audit log", icon: History, description: "Operator activity" },
  { href: "/admin/admins", label: "Admins", icon: ShieldCheck, description: "System access" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-start gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition",
        active
          ? "bg-card text-primary shadow-[0_1px_2px_rgba(16,24,40,0.06)] dark:shadow-none"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 flex-none", active ? "text-primary" : "opacity-70")} />
      <span className="min-w-0">
        <span className="block leading-4">{item.label}</span>
        <span className={cn("mt-0.5 block text-[11px] font-normal leading-4", active ? "text-primary/70" : "text-muted-foreground/75")}>
          {item.description}
        </span>
      </span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-foreground dark:bg-background">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[248px_1fr]">
        {/* Sidebar — flush to the left edge, sticky on scroll */}
        <aside className="hidden flex-col border-r border-border bg-card p-3 md:flex md:sticky md:top-0 md:h-screen md:self-start">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-muted"
            aria-label="CloudWatcher Admin"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center overflow-visible">
              <Image
                src="/Logo.svg"
                alt="CloudWatcher"
                width={44}
                height={44}
                className="h-[120%] w-[120%] max-w-none object-contain"
                priority
              />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-bold tracking-tight">CloudWatcher</div>
              <div className="text-[11px] font-medium text-muted-foreground">Billing and access</div>
            </div>
          </Link>

          <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Manage
          </div>
          <nav className="flex flex-col gap-0.5">
            {MANAGE.map((i) => (
              <NavLink key={i.href} item={i} pathname={pathname} />
            ))}
          </nav>

          <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            System
          </div>
          <nav className="flex flex-col gap-0.5">
            {SYSTEM.map((i) => (
              <NavLink key={i.href} item={i} pathname={pathname} />
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-1">
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <User className="h-4 w-4 flex-none opacity-70" /> Profile
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4 flex-none opacity-70" /> Log out
            </button>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border/70 bg-[color-mix(in_srgb,var(--good,#16a34a)_8%,transparent)] px-3 py-2.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--good,#16a34a)]" />
              <span>
                <b className="text-[var(--good,#16a34a)]">2FA enforced</b> · system admin
              </span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-col">
          {/* Mobile-only nav — the sidebar is hidden on small screens. */}
          <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
            {[...MANAGE, ...SYSTEM].map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium",
                  isActive(pathname, i.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                {i.label}
              </Link>
            ))}
          </nav>

          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
