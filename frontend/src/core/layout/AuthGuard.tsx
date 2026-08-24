"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, ArrowLeft } from "@/icons";
import { GlobalAiAgentWidget } from "@/components/chat/GlobalAiAgentWidget";
import { ActionExecutionToast } from "@/components/ActionExecutionToast";
import { AppTopNav } from "@/components/AppTopNav";
import { CommandPalette } from "@/components/CommandPalette";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/login/2fa",
  "/signup",
  "/verify-signup",
  "/forgot-password",
  "/reset-password",
  "/oauth/callback",
];

const PUBLIC_PREFIXES = ["/docs"];
const PRIVATE_PATHS = [
  "/actions",
  "/ai-observability",
  "/ai-observability/alerts",
  "/ai-observability/cost",
  "/ai-observability/errors",
  "/ai-observability/evaluations",
  "/ai-observability/models",
  "/ai-observability/playground",
  "/ai-observability/prompts",
  "/ai-observability/recommendations",
  "/ai-observability/scores",
  "/ai-observability/sessions",
  "/ai-observability/traces",
  "/ai-observability/users",
  "/cost-savings",
  "/dashboard",
  "/profile",
  "/recommendations",
  "/resize-migration",
  "/services",
  "/settings/ai-keys",
  "/settings/ai-observability",
  "/settings/ai-observability/pricing",
  "/settings/ai-observability/scores",
  "/settings/aws",
  "/settings/azure",
  "/settings/gcp",
  "/settings/github",
  "/settings/reports",
  "/simulation",
  "/simulations",
  "/simulations/live-canvas",
  "/vps-logs",
  "/watchdog",
];
const PRIVATE_DYNAMIC_PATHS = [
  /^\/ai-observability\/request\/[^/]+$/,
  /^\/ai-observability\/sessions\/[^/]+$/,
  /^\/ai-observability\/traces\/[^/]+$/,
  /^\/ai-observability\/users\/[^/]+$/,
  /^\/dashboards\/[^/]+$/,
  /^\/resize-migration\/[^/]+$/,
  /^\/simulations\/live-canvas\/[^/]+$/,
];
const LOGOUT_REDIRECT_KEY = "rabbittize_post_logout_redirect";
const LOGOUT_LANDING_KEY = "rabbittize_show_landing_after_logout";

function isKnownApplicationPath(pathname: string) {
  return (
    PRIVATE_PATHS.includes(pathname) ||
    PRIVATE_DYNAMIC_PATHS.some((pattern) => pattern.test(pathname))
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isDashboardRoute = pathname === "/dashboard";
  const isSimulationRoute =
    pathname === "/simulation" ||
    /^\/simulations\/live-canvas\/.+/.test(pathname);
  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  const isDocsRoute =
    pathname === "/docs" || pathname.startsWith("/docs/");

  if (isDocsRoute) {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Landing page — clear logout redirect state if present
  if (pathname === "/") {
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem(LOGOUT_LANDING_KEY)
    ) {
      sessionStorage.removeItem(LOGOUT_LANDING_KEY);
      sessionStorage.removeItem(LOGOUT_REDIRECT_KEY);
    }
    return <>{children}</>;
  }

  // Public pages (login/signup) — render without sidebar, but redirect to dashboard if already logged in
  if (isPublicPath) {
    if (
      user &&
      (pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/login/2fa" ||
        pathname === "/signup/verify")
    ) {
      if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      }
      return null;
    }
    return <>{children}</>;
  }

  if (!isKnownApplicationPath(pathname)) {
    return <>{children}</>;
  }

  // Not authenticated — redirect to login
  if (!user) {
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem(LOGOUT_LANDING_KEY)) {
        // Force redirection to the landing page if a logout is in progress
        window.location.href = "/";
        return null;
      }
      const logoutRedirect = sessionStorage.getItem(LOGOUT_REDIRECT_KEY);
      if (logoutRedirect) {
        sessionStorage.removeItem(LOGOUT_REDIRECT_KEY);
        window.location.href = logoutRedirect;
        return null;
      }
    }
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  if (isSimulationRoute) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A] dark:bg-[#020617] dark:text-white">
        <main className="h-full w-full">{children}</main>
        <ActionExecutionToast />
        <GlobalAiAgentWidget />
      </div>
    );
  }

  // System admins get a focused, chrome-less profile — no customer-app sidebar
  // or top nav, just a link back to the admin panel.
  if (user?.isSystemAdmin && pathname === "/profile") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-5 py-3 backdrop-blur">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-[9px] border border-border bg-card px-3 py-1.5 text-[13px] font-medium transition hover:border-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin panel
          </Link>
          <span className="text-[13px] text-muted-foreground">Your profile</span>
        </div>
        <main className="mx-auto max-w-[1520px] px-5 py-6">{children}</main>
        <ActionExecutionToast />
      </div>
    );
  }

  // Authenticated — render with sidebar + top nav (AppShell layout)
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] dark:bg-[#020617] dark:text-white">
      <AppTopNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main
          data-lenis-prevent
          className="relative isolate flex-1 overflow-y-auto"
        >
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_8%_4%,rgba(26,86,219,0.10),transparent_26%),radial-gradient(circle_at_92%_6%,rgba(249,115,22,0.10),transparent_24%),linear-gradient(180deg,#F8FAFC_0%,#FFFFFF_54%)] dark:bg-[radial-gradient(circle_at_8%_4%,rgba(59,130,246,0.16),transparent_26%),radial-gradient(circle_at_92%_6%,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,#07111F_0%,#050D1A_54%)]" />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />
          <div
            data-inner-route
            className="relative z-10 mx-auto max-w-[1520px] px-5 py-5"
          >
            {isDashboardRoute ? (
              children
            ) : (
              <section className="inner-route-frame">
                <div className="inner-route-grid" />
                <div className="inner-route-content">{children}</div>
              </section>
            )}
          </div>
        </main>
      </div>
      <ActionExecutionToast />
      <GlobalAiAgentWidget />
      <CommandPalette />
    </div>
  );
}
