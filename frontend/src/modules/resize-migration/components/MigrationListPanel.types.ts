import { useResizeMigration } from "../hooks/useResizeMigration";

export type MigrationListPanelProps = ReturnType<typeof useResizeMigration>;

export const ACTIVE_MIGRATION_STATUSES = [
  "draft",
  "preflight",
  "snapshotting",
  "launching_target",
  "validating",
  "awaiting_cutover",
  "cutover",
] as const;

export const statusTones: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  draft: {
    label: "Draft",
    bg: "bg-slate-50 dark:bg-slate-900/30",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-800",
  },
  preflight: {
    label: "Preflight",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-150 dark:border-blue-900/35",
  },
  snapshotting: {
    label: "Snapshotting",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-150 dark:border-amber-900/35",
  },
  launching_target: {
    label: "Launching Target",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-150 dark:border-violet-900/35",
  },
  validating: {
    label: "Validating",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-150 dark:border-cyan-900/35",
  },
  awaiting_cutover: {
    label: "Awaiting Cutover",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-150 dark:border-orange-900/35",
  },
  cutover: {
    label: "Cutover Active",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-150 dark:border-indigo-900/35",
  },
  completed: {
    label: "Completed",
    bg: "bg-emerald-50 dark:bg-emerald-955/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-150 dark:border-emerald-900/35",
  },
  failed: {
    label: "Failed",
    bg: "bg-red-50 dark:bg-red-955/20",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-150 dark:border-red-900/35",
  },
  rolled_back: {
    label: "Rolled Back",
    bg: "bg-pink-50 dark:bg-pink-900/20",
    text: "text-pink-600 dark:text-pink-400",
    border: "border-pink-150 dark:border-pink-900/35",
  },
};

