"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "@/icons";
import type { MigrationJob } from "../../types";

interface MigrationDetailsTabProps {
  activeJob: MigrationJob;
}

export function MigrationDetailsTab({ activeJob }: MigrationDetailsTabProps) {
  return (
    <Card className="xl:col-span-2 border-[#e8eaee] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0A1220] select-text">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
        <CardTitle className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
          <Info className="h-4 w-4 text-blue-500" /> Job Configurations
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Provider
          </span>
          <span className="mt-1 block text-sm font-extrabold uppercase text-slate-800 dark:text-slate-100">
            {activeJob.provider}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Region
          </span>
          <span className="mt-1 block text-sm font-extrabold text-slate-800 dark:text-slate-100">
            {activeJob.region}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Source Server
          </span>
          <span
            className="mt-1 block truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-100"
            title={activeJob.sourceServerId}
          >
            {activeJob.sourceServerId}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Target Instance
          </span>
          <span className="mt-1 block text-sm font-extrabold text-slate-800 dark:text-slate-100">
            {activeJob.targetServerType}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Created Image
          </span>
          <span
            className="mt-1 block truncate font-mono text-xs font-bold text-slate-500"
            title={activeJob.sourceImageId || "Pending"}
          >
            {activeJob.sourceImageId || "Pending"}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-955/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Detected OS/Image
          </span>
          <span
            className="mt-1 block truncate text-xs font-bold text-slate-600 dark:text-slate-300"
            title={
              activeJob.metadata?.sourceAccessProfile?.platformDetails ||
              activeJob.metadata?.sourceAccessProfile?.imageName ||
              "Pending"
            }
          >
            {activeJob.metadata?.sourceAccessProfile?.platformDetails ||
              activeJob.metadata?.sourceAccessProfile?.imageName ||
              "Pending"}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-955/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            SSH Key Pair
          </span>
          <span
            className="mt-1 block truncate font-mono text-xs font-bold text-slate-600 dark:text-slate-300"
            title={
              activeJob.metadata?.targetAccessProfile?.keyPairName ||
              activeJob.metadata?.sourceAccessProfile?.keyPairName ||
              "No EC2 key pair detected"
            }
          >
            {activeJob.metadata?.targetAccessProfile?.keyPairName ||
              activeJob.metadata?.sourceAccessProfile?.keyPairName ||
              "No EC2 key pair detected"}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-955/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Suggested SSH User
          </span>
          <span className="mt-1 block font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
            {activeJob.metadata?.targetAccessProfile?.suggestedUsername ||
              activeJob.metadata?.sourceAccessProfile?.suggestedUsername ||
              activeJob.accessConfig?.username ||
              "Detect after boot"}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-955/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Bootstrap Reused
          </span>
          <span className="mt-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
            {activeJob.metadata?.targetAccessProfile?.userDataCopied
              ? "Source user-data copied"
              : activeJob.metadata?.sourceAccessProfile?.hasUserData
              ? "Will copy during target launch"
              : "No source user-data found"}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-955/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Target Host
          </span>
          <span
            className="mt-1 block truncate font-mono text-xs font-bold text-slate-500"
            title={
              activeJob.metadata?.targetAccessProfile?.publicDnsName ||
              activeJob.metadata?.targetAccessProfile?.publicIp ||
              activeJob.metadata?.targetAccessProfile?.privateIp ||
              "Awaiting target IP"
            }
          >
            {activeJob.metadata?.targetAccessProfile?.publicDnsName ||
              activeJob.metadata?.targetAccessProfile?.publicIp ||
              activeJob.metadata?.targetAccessProfile?.privateIp ||
              "Awaiting target IP"}
          </span>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-955/20">
          <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Launched Server
          </span>
          <span
            className="mt-1 block truncate font-mono text-xs font-bold text-slate-500"
            title={activeJob.targetServerId || "Pending"}
          >
            {activeJob.targetServerId || "Pending"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
