import { Suspense } from "react";
import type { Metadata } from "next";
import { AgentWatcherExperience } from "@/modules/cloudwatcher-agent-watcher";
import { AgentWatcherQueryProvider } from "./QueryProvider";

export const metadata: Metadata = {
  title: "Agent Watcher - Audit your AI harness",
  description:
    "Hand your coding agent a strict prompt that audits your AI system's harness, roadmap, gaps, probes, and evidence-backed Cloudcam score.",
  alternates: { canonical: "/agent-watcher" },
};

export default function AgentWatcherPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-[3px] border-[#E2E8F0]" />
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#1A56DB]" />
          </div>
        </div>
      }
    >
      <AgentWatcherQueryProvider>
        <AgentWatcherExperience />
      </AgentWatcherQueryProvider>
    </Suspense>
  );
}
