import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, Server, Trash2 } from "@/icons";
import { ACTIVE_MIGRATION_STATUSES, MigrationListPanelProps, statusTones } from "./MigrationListPanel.types";

type Props = Pick<
  MigrationListPanelProps,
  | "jobs"
  | "filteredJobs"
  | "filterTab"
  | "setFilterTab"
  | "isLoadingList"
  | "setIsCreateOpen"
  | "handleOpenJob"
  | "handleDeleteJob"
>;

export function MigrationJobList({
  jobs,
  filteredJobs,
  filterTab,
  setFilterTab,
  isLoadingList,
  setIsCreateOpen,
  handleOpenJob,
  handleDeleteJob,
}: Props) {
  return (
    <>
    <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm mb-2">
      <button
        onClick={() => setFilterTab("all")}
        className={`pb-2.5 font-bold ${
          filterTab === "all"
            ? "text-[#2563eb] border-b-2 border-[#2563eb]"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-350"
        }`}
      >
        All ({jobs.length})
      </button>
      <button
        onClick={() => setFilterTab("active")}
        className={`pb-2.5 font-bold ${
          filterTab === "active"
            ? "text-[#2563eb] border-b-2 border-[#2563eb]"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-350"
        }`}
      >
        Active (
        {
          jobs.filter((j) =>
            ACTIVE_MIGRATION_STATUSES.includes(j.status as any)
          ).length
        }
        )
      </button>
      <button
        onClick={() => setFilterTab("archived")}
        className={`pb-2.5 font-bold ${
          filterTab === "archived"
            ? "text-[#2563eb] border-b-2 border-[#2563eb]"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-350"
        }`}
      >
        Archived (
        {
          jobs.filter(
            (j) =>
              !ACTIVE_MIGRATION_STATUSES.includes(j.status as any)
          ).length
        }
        )
      </button>
    </div>

    {isLoadingList ? (
      <div className="flex min-h-[260px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8c949f]" />
      </div>
    ) : filteredJobs.length === 0 ? (
      <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/10 min-h-[260px] flex flex-col justify-center items-center p-8 text-center rounded-xl">
        <div className="bg-[#eff6ff] dark:bg-[#13233a] p-4 rounded-full mb-4">
          <Server className="h-10 w-10 text-[#2563eb]" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-2">
          No resize migrations found
        </h3>
        <p className="text-sm text-slate-500 font-semibold max-w-sm mb-6 leading-relaxed">
          {filterTab === "all"
            ? "Create a resize migration to clone your live servers to a larger or smaller instance size."
            : filterTab === "active"
            ? "There are no active migrations running currently."
            : "There are no completed or rolled back migrations in history."}
        </p>
        {filterTab === "all" && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#2563eb] text-white hover:bg-blue-700 font-extrabold text-[13px] h-10"
          >
            Get Started
          </Button>
        )}
      </Card>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {filteredJobs.map((job) => (
          <Card
            key={job._id}
            role="button"
            tabIndex={0}
            onClick={() => handleOpenJob(job)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenJob(job);
              }
            }}
            className="group relative cursor-pointer overflow-hidden border-[#e8eaee] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-[#1E293B] dark:bg-[#0A1220] dark:hover:border-blue-900/50"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 opacity-80" />
            <CardHeader className="flex flex-row justify-between items-start gap-3 p-4 pb-3">
              <div className="min-w-0 space-y-1">
                <h3 className="truncate font-extrabold text-[16px] text-slate-900 dark:text-white">
                  {job.sourceServerName || job.sourceServerId}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-505">
                  <span className="uppercase">{job.provider}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="font-mono">{job.region}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge
                  className={`${statusTones[job.status]?.bg} ${
                    statusTones[job.status]?.text
                  } ${
                    statusTones[job.status]?.border
                  } border text-[10px] font-extrabold px-2 py-1 rounded`}
                >
                  {statusTones[job.status]?.label || job.status}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteJob(job._id);
                  }}
                  className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                  aria-label="Delete resize migration"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-1 space-y-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900/30">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-extrabold tracking-wide text-[#94a3b8]">
                    Source
                  </span>
                  <span className="mt-1 block truncate font-mono text-sm font-extrabold text-slate-805 dark:text-slate-200">
                    {job.sourceServerType || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-[#94a3b8] transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="min-w-0 text-right">
                  <span className="text-[10px] uppercase font-extrabold tracking-wide text-[#94a3b8]">
                    Target
                  </span>
                  <span className="mt-1 block truncate font-mono text-sm font-extrabold text-slate-805 dark:text-slate-200">
                    {job.targetServerType}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <span className="font-semibold text-slate-400">
                  Created {new Date(job.createdAt).toLocaleDateString()}
                </span>
                <span className="font-extrabold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                  Open
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )}
    </>
  );
}
