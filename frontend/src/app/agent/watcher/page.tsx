import { Suspense } from "react";
import type { Metadata } from "next";
import { AgentWatcherExperience } from "@/modules/cloudwatcher-agent-watcher";
import { AgentWatcherQueryProvider } from "../../agent-watcher/QueryProvider";

export const metadata: Metadata = {
  title: "Agent Watcher - Audit your AI harness",
  description: "Evidence-first AI agent audit reports with actionable remediation detail.",
  alternates: { canonical: "/agent-watcher" },
};

/** Compatibility route for the product-facing /agent/watcher URL. */
export default function AgentWatcherCompatibilityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC]" />}>
      <AgentWatcherQueryProvider>
        <AgentWatcherExperience />
      </AgentWatcherQueryProvider>
    </Suspense>
  );
}
