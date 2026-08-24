"use client";

/**
 * AppShell — wraps children with the standard authenticated shell layout:
 * AppTopNav (top) + Sidebar (left) + main content area.
 *
 * Use inside authenticated pages when you need the shell without full
 * route-aware auth logic. For full auth+layout logic, use AuthGuard.
 */
import { Sidebar } from "@/components/Sidebar";
import { AppTopNav } from "@/components/AppTopNav";
import { ActionExecutionToast } from "@/components/ActionExecutionToast";
import { GlobalAiAgentWidget } from "@/components/chat/GlobalAiAgentWidget";

interface AppShellProps {
  children: React.ReactNode;
  /** Set to true when the content area is the dashboard (no inner-route-frame wrapper) */
  isDashboard?: boolean;
}

export function AppShell({ children, isDashboard = false }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] dark:bg-[#020617] dark:text-white">
      <AppTopNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main
          data-lenis-prevent
          className="relative isolate flex-1 overflow-y-auto"
        >
          {/* Ambient gradient background */}
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_8%_4%,rgba(26,86,219,0.10),transparent_26%),radial-gradient(circle_at_92%_6%,rgba(249,115,22,0.10),transparent_24%),linear-gradient(180deg,#F8FAFC_0%,#FFFFFF_54%)] dark:bg-[radial-gradient(circle_at_8%_4%,rgba(59,130,246,0.16),transparent_26%),radial-gradient(circle_at_92%_6%,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,#07111F_0%,#050D1A_54%)]" />
          {/* Grid overlay */}
          <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />
          <div
            data-inner-route
            className="relative z-10 mx-auto max-w-[1520px] px-5 py-5"
          >
            {isDashboard ? (
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
    </div>
  );
}
