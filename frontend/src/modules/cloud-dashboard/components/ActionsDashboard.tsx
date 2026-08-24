"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { ACTION_EXECUTION_EVENT } from "@/lib/action-events";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
  XCircle,
  Zap,
} from "@/icons";

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function toIsoOrEmpty(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysInCalendarMonth(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const blanks = Array.from({ length: first.getDay() }, () => null);
  const days = Array.from(
    { length: daysInMonth },
    (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
  );
  return [...blanks, ...days];
}

function formatPickerValue(value: string, placeholder: string) {
  const date = parseLocalDateTime(value);
  if (!date) return placeholder;
  return `${shortDateFormatter.format(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DateTimePicker({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseLocalDateTime(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const seed = selectedDate || new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });
  const hour = selectedDate ? selectedDate.getHours() : 0;
  const minute = selectedDate ? selectedDate.getMinutes() : 0;
  const calendarDays = useMemo(
    () => daysInCalendarMonth(visibleMonth),
    [visibleMonth],
  );

  const commitDatePart = (day: Date) => {
    const next = new Date(day);
    next.setHours(hour, minute, 0, 0);
    onChange(toDateTimeValue(next));
  };

  const commitTimePart = (nextHour: number, nextMinute: number) => {
    const next = selectedDate || new Date();
    next.setHours(nextHour, nextMinute, 0, 0);
    onChange(toDateTimeValue(next));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-10 min-w-[178px] items-center gap-2 rounded-[7px] border px-3 text-left transition ${
          value
            ? "border-[#b8cdf8] bg-[#f4f7ff] text-[#24447d]"
            : "border-[#e5e8ee] bg-white text-[#717985] hover:border-[#d4d9e2] hover:text-[#24272d]"
        }`}
      >
        <CalendarDays className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]">
            {label}
          </span>
          <span className="block truncate text-[12px] font-extrabold">
            {formatPickerValue(value, placeholder)}
          </span>
        </span>
      </button>

      {open ? (
        <div className="fixed right-6 top-28 z-[90] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-[#dfe3ea] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-[#eceef2] bg-[#fbfcfd] px-3 py-3">
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#717985] transition hover:bg-white hover:text-[#24272d]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-[13px] font-extrabold text-[#2c3037]">
              {monthLabelFormatter.format(visibleMonth)}
            </p>
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#717985] transition hover:bg-white hover:text-[#24272d]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a1a7b0]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const selected = Boolean(
                  day &&
                  selectedDate &&
                  day.toDateString() === selectedDate.toDateString(),
                );
                return day ? (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => commitDatePart(day)}
                    className={`h-9 rounded-[6px] text-[12px] font-extrabold transition ${
                      selected
                        ? "bg-[#2563eb] text-white shadow-sm"
                        : "text-[#3d424a] hover:bg-[#f1f3f6]"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span key={`blank-${index}`} />
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#eceef2] pt-3">
              <label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#717985]">
                Hour
                <select
                  value={hour}
                  onChange={(event) =>
                    commitTimePart(Number(event.target.value), minute)
                  }
                  className="mt-1 h-9 w-full rounded-[6px] border border-[#e5e8ee] bg-[#fafafa] px-2 text-[12px] font-extrabold text-[#2c3037] outline-none focus:border-[#2563eb]"
                >
                  {Array.from({ length: 24 }, (_, item) => (
                    <option key={item} value={item}>
                      {pad(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#717985]">
                Minute
                <select
                  value={minute}
                  onChange={(event) =>
                    commitTimePart(hour, Number(event.target.value))
                  }
                  className="mt-1 h-9 w-full rounded-[6px] border border-[#e5e8ee] bg-[#fafafa] px-2 text-[12px] font-extrabold text-[#2c3037] outline-none focus:border-[#2563eb]"
                >
                  {Array.from({ length: 12 }, (_, item) => item * 5).map(
                    (item) => (
                      <option key={item} value={item}>
                        {pad(item)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onChange(toDateTimeValue(new Date()))}
                className="h-8 rounded-[6px] px-3 text-[12px] font-extrabold text-[#2563eb] transition hover:bg-[#eff6ff]"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 rounded-[6px] bg-[#24272d] px-3 text-[12px] font-extrabold text-white transition hover:bg-[#111827]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ActionRecord {
  _id: string;
  actionId: string;
  displayName?: string;
  service?: string;
  targets: { resourceId: string; resourceName: string; region: string }[];
  status: string;
  riskLevel: string;
  reversible: boolean;
  estimatedSavings: number;
  simulationMode: boolean;
  reasoning?: string;
  safetyWarnings: string[];
  createdAt: string;
  completedAt?: string;
  executedAt?: string;
  approvedAt?: string;
  errorMessage?: string;
  postActionResult?: {
    targetErrors?: Array<{
      target: {
        resourceId: string;
        region?: string;
      };
      error: string;
    }>;
  };
}

const statusCopy: Record<
  string,
  { label: string; tone: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  created: { label: "Created", tone: "text-slate-500", Icon: Clock },
  pending_review: {
    label: "Pending review",
    tone: "text-amber-600",
    Icon: Shield,
  },
  approved: { label: "Approved", tone: "text-blue-600", Icon: CheckCircle },
  executing: { label: "Executing", tone: "text-violet-600", Icon: Zap },
  completed: {
    label: "Completed",
    tone: "text-emerald-600",
    Icon: CheckCircle,
  },
  partially_failed: {
    label: "Partial failure",
    tone: "text-orange-600",
    Icon: AlertTriangle,
  },
  failed: { label: "Failed", tone: "text-red-600", Icon: XCircle },
  rolled_back: {
    label: "Rolled back",
    tone: "text-purple-600",
    Icon: RotateCcw,
  },
  simulated: { label: "Logged", tone: "text-slate-500", Icon: Zap },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatAuditDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${day} - ${time}`;
}

function actionTitle(action: ActionRecord) {
  const raw = action.displayName || action.actionId || "Recorded action";
  return raw
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function primaryTarget(action: ActionRecord) {
  const target = action.targets?.[0];
  return target?.resourceName || target?.resourceId || "No resource recorded";
}

function actionTime(action: ActionRecord) {
  return (
    action.completedAt ||
    action.executedAt ||
    action.approvedAt ||
    action.createdAt
  );
}

function actionVerb(action: ActionRecord) {
  const title = actionTitle(action).toLowerCase();
  if (action.status === "failed" || action.status === "partially_failed")
    return "Flagged an issue while processing";
  if (title.includes("delete") || title.includes("destroy"))
    return "Initiated deletion of";
  if (title.includes("stop")) return "Stopped";
  if (title.includes("start")) return "Started";
  if (title.includes("rollback")) return "Rolled back";
  if (title.includes("revoke")) return "Revoked";
  if (action.status === "approved") return "Approved recommendation for";
  if (action.status === "simulated") return "Logged simulation action for";
  return "Processed";
}

function auditHeadline(action?: ActionRecord) {
  if (!action) return "Action audit trail";
  const target = primaryTarget(action);
  if (action.estimatedSavings > 0) {
    return `Save ${formatCurrency(action.estimatedSavings)} by ${actionTitle(action)} ${target}`;
  }
  return `${actionTitle(action)} ${target}`;
}

function chipIcon(action: ActionRecord) {
  const title = actionTitle(action).toLowerCase();
  if (title.includes("delete") || title.includes("destroy")) return Trash2;
  return HardDrive;
}

export function ActionsDashboard() {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  const hasCustomRange = Boolean(customStart || customEnd);

  const fetchActions = useCallback(
    async (options?: { forceRefresh?: boolean; background?: boolean }) => {
      if (!options?.background) setIsLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          limit: "40",
        });
        const startIso = toIsoOrEmpty(customStart);
        const endIso = toIsoOrEmpty(customEnd);
        if (startIso) query.set("start", startIso);
        if (endIso) query.set("end", endIso);
        if (selectedProvider && selectedProvider !== "all") {
          query.set("provider", selectedProvider);
        }
        const requestOptions = options?.forceRefresh
          ? { headers: { "x-rabbittwatch-cache-bypass": "true" } }
          : undefined;
        const response = await authFetch(
          `/api/aws/actions/history?${query.toString()}`,
          requestOptions,
        );
        const data = await response.json();
        if (!data.success)
          throw new Error(data.error || "Unable to load audit logs");
        setActions(data.actions || []);
        setTotal(data.total || data.actions?.length || 0);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load audit logs",
        );
      } finally {
        if (!options?.background) setIsLoading(false);
      }
    },
    [customEnd, customStart, selectedProvider],
  );

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  useEffect(() => {
    const onActionExecution = () =>
      fetchActions({ forceRefresh: true, background: true });
    window.addEventListener(ACTION_EXECUTION_EVENT, onActionExecution);
    return () =>
      window.removeEventListener(ACTION_EXECUTION_EVENT, onActionExecution);
  }, [fetchActions]);

  const latestAction = actions[0];
  const totalSavings = useMemo(
    () =>
      actions.reduce(
        (sum, action) =>
          sum +
          (action.status === "completed" ? action.estimatedSavings || 0 : 0),
        0,
      ),
    [actions],
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f6f7f9] p-0 text-[#24272d] dark:bg-[#f6f7f9]">
      <section className="flex min-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-[8px] border border-[#e8eaee] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#eceef2] px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-start gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-5 text-[#9aa0a9]">
                Audit Logs
              </p>
              <h1 className="mt-0.5 text-[19px] font-extrabold leading-6 text-[#2c3037] sm:text-[20px]">
                {auditHeadline(latestAction)}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="h-10 rounded-[7px] border border-[#dfe3ea] bg-white px-3 text-[12px] font-extrabold text-[#2c3037] outline-none focus:border-[#2563eb] hover:border-[#d4d9e2] cursor-pointer"
              >
                <option value="all">All Providers</option>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">GCP</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-[7px] border border-[#dfe3ea] bg-[#fafafa] px-2 py-1">
              <DateTimePicker
                label="From"
                value={customStart}
                placeholder="Start time"
                onChange={setCustomStart}
              />
              <DateTimePicker
                label="To"
                value={customEnd}
                placeholder="End time"
                onChange={setCustomEnd}
              />
              {hasCustomRange ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className="h-8 rounded-[5px] px-2 text-[12px] font-extrabold text-[#717985] transition hover:bg-white hover:text-[#24272d]"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => fetchActions({ forceRefresh: true })}
              disabled={isLoading}
              className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#e5e8ee] bg-[#fafafa] text-[#717985] transition hover:border-[#d4d9e2] hover:bg-[#f1f3f6] hover:text-[#24272d]"
              title="Refresh actions"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        <div className="grid border-b border-[#eceef2] bg-[#fbfcfd] sm:grid-cols-3">
          <div className="border-b border-[#eceef2] px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#a1a7b0]">
              Records
            </p>
            <p className="mt-1 text-[24px] font-extrabold leading-none text-[#2c3037]">
              {total}
            </p>
          </div>
          <div className="border-b border-[#eceef2] px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#a1a7b0]">
              Savings
            </p>
            <p className="mt-1 text-[24px] font-extrabold leading-none text-[#23824b]">
              {formatCurrency(totalSavings)}
            </p>
          </div>
          <div className="px-5 py-4 sm:px-7">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#a1a7b0]">
              Latest status
            </p>
            <p className="mt-1 text-[24px] font-extrabold leading-none text-[#2c3037]">
              {latestAction
                ? (statusCopy[latestAction.status] || statusCopy.created).label
                : "Ready"}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-6 sm:px-7">
          {error ? (
            <div className="rounded-[8px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {isLoading && actions.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#8c949f]" />
            </div>
          ) : actions.length === 0 ? (
            <div className="relative min-h-[420px]">
              <div className="absolute left-[9px] top-[18px] h-[220px] w-px bg-[#d8f1e1]" />
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-6 pb-10"
                >
                  <div className="relative z-10 mt-[3px] flex h-5 w-5 items-center justify-center rounded-full border border-[#bfeaca] bg-[#effaf3]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#c8efd4]" />
                  </div>
                  <div className="max-w-4xl">
                    <div className="h-5 w-44 rounded bg-[#f0f2f5]" />
                    <div className="mt-3 h-5 w-full max-w-[680px] rounded bg-[#f5f6f8]" />
                    <div className="mt-4 h-8 w-52 rounded-[4px] border border-[#edf0f3] bg-[#fafafa]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ol className="relative mt-1">
              <div className="absolute left-[9px] top-[18px] h-[calc(100%-38px)] w-px bg-[#75d99e]" />
              {actions.map((action, index) => {
                const status = statusCopy[action.status] || statusCopy.created;
                const StatusIcon = status.Icon;
                const ResourceIcon = chipIcon(action);
                const target = primaryTarget(action);
                const errorText =
                  action.postActionResult?.targetErrors?.[0]?.error ||
                  action.errorMessage;

                return (
                  <li
                    key={action._id}
                    className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-6 pb-7 last:pb-0"
                  >
                    <div className="relative z-10 mt-[3px] flex h-5 w-5 items-center justify-center rounded-full border border-[#62cf8e] bg-[#dff8e8]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#3fc873]" />
                    </div>

                    <article className="min-w-0">
                      <time className="block text-[16px] font-medium leading-5 text-[#959ba5]">
                        {formatAuditDate(actionTime(action))}
                      </time>
                      <p className="mt-1 text-[16px] leading-6 text-[#555b65]">
                        <span className="font-extrabold text-[#2f343b]">
                          CloudWatcher.
                        </span>{" "}
                        {actionVerb(action)} {target}
                        {action.targets?.[0]?.region
                          ? ` in ${action.targets[0].region}`
                          : ""}
                        .
                      </p>

                      {action.reasoning ? (
                        <p className="mt-2 max-w-[520px] text-[13px] leading-5 text-[#808792]">
                          {action.reasoning}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] border border-[#e8eaee] bg-[#fafafa] px-2.5 py-1 text-[15px] font-bold text-[#3d424a] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                          <ResourceIcon className="h-4 w-4 shrink-0 text-[#2f343b]" />
                          <span className="truncate">{target}</span>
                        </span>

                        {index === 0 && action.status === "completed" ? (
                          <>
                            <ArrowRight className="h-4 w-4 text-[#6f7680]" />
                            <span className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] border border-[#e8eaee] bg-[#fafafa] px-2.5 py-1 text-[15px] font-bold text-[#3d424a] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                              <Trash2 className="h-4 w-4 shrink-0 text-[#2f343b]" />
                              <span className="truncate">{target}</span>
                            </span>
                          </>
                        ) : null}

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-[4px] border border-[#e8eaee] bg-white px-2.5 py-1 text-[13px] font-bold ${status.tone}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>

                        {action.service ? (
                          <span className="inline-flex items-center rounded-[4px] border border-[#e8eaee] bg-white px-2.5 py-1 text-[13px] font-bold uppercase text-[#6b7280]">
                            {action.service}
                          </span>
                        ) : null}

                        {(action as any).provider ? (
                          <span
                            className={`inline-flex items-center rounded-[4px] border px-2.5 py-1 text-[13px] font-extrabold uppercase ${(action as any).provider === "aws" ? "border-[#ffe2cc] bg-[#fff0e5] text-[#e67300]" : (action as any).provider === "azure" ? "border-[#cce3f5] bg-[#e6f2fc] text-[#0066b3]" : "border-[#ccd9f5] bg-[#e6eeff] text-[#1a53ff]"}`}
                          >
                            {(action as any).provider}
                          </span>
                        ) : null}

                        {action.estimatedSavings > 0 ? (
                          <span className="inline-flex items-center rounded-[4px] border border-[#cbeed9] bg-[#f1fbf5] px-2.5 py-1 text-[13px] font-extrabold text-[#23824b]">
                            {formatCurrency(action.estimatedSavings)}/mo
                          </span>
                        ) : null}
                      </div>

                      {errorText ? (
                        <p className="mt-3 flex items-start gap-2 text-[13px] font-semibold leading-5 text-red-600">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          {errorText}
                        </p>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </main>
  );
}
