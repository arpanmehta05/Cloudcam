"use client";

import {
  BrainCircuit,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Send,
  XCircle,
} from "@/icons";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useReportSettings } from "../hooks/useReportSettings";
import { PreferenceSet, ReportType } from "../types";

const DEFAULT_SECTIONS: Record<ReportType, string[]> = {
  usage: ["summary", "topServices", "schedule"],
  insight: ["recommendations", "diagnosis", "optimizations", "alerts"],
};

const SECTION_OPTIONS: Record<ReportType, Array<{ id: string; label: string; description: string }>> = {
  usage: [
    { id: "summary", label: "Spend summary", description: "Current spend and projected total." },
    { id: "topServices", label: "Top services", description: "Highest cost services across all connected clouds for the period." },
    { id: "schedule", label: "Delivery schedule", description: "Frequency and next scheduled send." },
  ],
  insight: [
    { id: "recommendations", label: "Recommendations", description: "AI generated improvement ideas." },
    { id: "diagnosis", label: "Diagnosis", description: "Warning, critical, and informational findings." },
    { id: "optimizations", label: "Optimization actions", description: "Actions with priority and savings context." },
    { id: "alerts", label: "Alerts", description: "Warning and critical findings highlighted in email/PDF." },
  ],
};

const DAYS_OF_WEEK = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateNextDelivery(prefs: PreferenceSet, from = new Date()) {
  const [hours = 9, minutes = 0] = (prefs.timeOfDay || "09:00").split(":").map(Number);
  const next = new Date(from);
  next.setUTCHours(hours, minutes, 0, 0);

  if (prefs.frequency === "weekly") {
    const targetDay = typeof prefs.dayOfWeek === "number" ? prefs.dayOfWeek : 1;
    const daysToAdd = (targetDay - from.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + daysToAdd);
    if (next <= from) {
      next.setUTCDate(next.getUTCDate() + 7);
    }
    return next.toISOString();
  }

  const targetDay = Math.min(Math.max(Number(prefs.dayOfMonth) || 1, 1), 31);
  const setClampedMonthDay = (date: Date) => {
    const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(targetDay, daysInMonth));
  };

  next.setUTCDate(1);
  setClampedMonthDay(next);
  if (next <= from) {
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    setClampedMonthDay(next);
  }

  return next.toISOString();
}

function deliverySummary(prefs: PreferenceSet) {
  if (prefs.frequency === "weekly") {
    return `${DAYS_OF_WEEK.find(day => day.value === prefs.dayOfWeek)?.label || "Monday"} at ${prefs.timeOfDay || "09:00"} UTC`;
  }

  const day = Math.min(Math.max(Number(prefs.dayOfMonth) || 1, 1), 31);
  return `Day ${day} at ${prefs.timeOfDay || "09:00"} UTC`;
}

function getMonthlyCalendarMeta(prefs: PreferenceSet) {
  const next = new Date(calculateNextDelivery({ ...prefs, frequency: "monthly" }));
  const year = next.getUTCFullYear();
  const month = next.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const label = next.toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  return { firstDay, daysInMonth, label };
}

function MonthPicker({ accent, prefs, onSelect }: { accent: "blue" | "purple"; prefs: PreferenceSet; onSelect: (day: number) => void }) {
  const { firstDay, daysInMonth, label } = getMonthlyCalendarMeta(prefs);
  const selectedDay = Math.min(Math.max(Number(prefs.dayOfMonth) || 1, 1), daysInMonth);
  const cells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ key: `blank-${index}`, day: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-extrabold text-slate-950">{label}</p>
          <p className="text-xs font-medium text-slate-500">Select the monthly delivery date</p>
        </div>
        <Badge variant="outline" className={cn("font-bold", accent === "blue" ? "border-blue-100 bg-blue-50 text-blue-700" : "border-purple-100 bg-purple-50 text-purple-700")}>
          {selectedDay}
        </Badge>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <div key={`${day}-${index}`} className="py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            {day}
          </div>
        ))}
        {cells.map((cell) => cell.day ? (
          <button
            key={cell.key}
            type="button"
            onClick={() => onSelect(cell.day!)}
            className={cn(
              "aspect-square rounded-lg text-xs font-bold transition hover:bg-slate-100",
              cell.day === selectedDay
                ? accent === "blue"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-600"
                  : "bg-purple-600 text-white shadow-sm shadow-purple-200 hover:bg-purple-600"
                : "text-slate-700"
            )}
          >
            {cell.day}
          </button>
        ) : (
          <div key={cell.key} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ type, title, description, icon, prefs, saving, sending, onUpdate, onSectionToggle, onSendNow }: any) {
  const nextDelivery = calculateNextDelivery(prefs);
  const selectedSections = prefs.sections?.length ? prefs.sections : DEFAULT_SECTIONS[type as ReportType];

  return (
    <Card className="h-fit overflow-hidden border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_100%)] pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-950">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", type === "usage" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                {icon}
              </span>
              {title}
            </CardTitle>
            <CardDescription className="max-w-sm text-sm leading-6 text-slate-600">{description}</CardDescription>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
            SCHEDULED
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className={cn("rounded-xl border p-4", type === "usage" ? "border-blue-100 bg-blue-50/70" : "border-purple-100 bg-purple-50/70")}>
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center", type === "usage" ? "text-blue-600" : "text-purple-600")}>
              <CalendarClock className="h-6 w-6 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-950">Automated delivery is scheduled</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                This report follows the calendar rule below. Manual sends do not move the scheduled delivery date.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
              <CheckSquare className="h-3.5 w-3.5" /> Report content
            </Label>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600">
              {selectedSections.length} selected
            </Badge>
          </div>
          <div className="grid gap-2">
            {SECTION_OPTIONS[type as ReportType].map((section) => {
              const checked = selectedSections.includes(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionToggle(type, section.id)}
                  className={cn(
                    "flex min-h-16 items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition",
                    checked
                      ? type === "usage"
                        ? "border-blue-200 bg-blue-50/80"
                        : "border-purple-200 bg-purple-50/80"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <span className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked
                      ? type === "usage"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-purple-600 bg-purple-600 text-white"
                      : "border-slate-300 bg-white"
                  )}>
                    {checked && <CheckCircle2 className="h-3 w-3" />}
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold text-slate-950">{section.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">{section.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" /> Frequency
              </Label>
              <div className="flex gap-1.5">
                {["weekly", "monthly"].map(f => (
                  <Button key={f} variant={prefs.frequency === f ? "default" : "outline"} size="sm" onClick={() => onUpdate(type, "frequency", f)} className={cn("h-9 flex-1 capitalize text-xs font-bold", prefs.frequency === f && (type === "usage" ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"))}>{f}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                <Clock3 className="h-3.5 w-3.5" /> Time (UTC)
              </Label>
              <input type="time" value={prefs.timeOfDay || "09:00"} onChange={e => onUpdate(type, "timeOfDay", e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{prefs.frequency === "weekly" ? "Delivery Day" : "Day of Month"}</Label>
            {prefs.frequency === "weekly" ? (
              <select value={prefs.dayOfWeek} onChange={e => onUpdate(type, "dayOfWeek", Number(e.target.value))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
                {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            ) : (
              <MonthPicker
                accent={type === "usage" ? "blue" : "purple"}
                prefs={prefs}
                onSelect={(day) => onUpdate(type, "dayOfMonth", day)}
              />
            )}
          </div>
        </div>

        <div className="grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Next delivery</p>
            <p className="mt-1 text-base font-extrabold text-slate-950">{formatDate(nextDelivery)}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{deliverySummary(prefs)}</p>
          </div>
          <div className="flex items-stretch sm:w-40">
            <Button variant="outline" size="sm" onClick={onSendNow} disabled={sending} className={cn("h-full min-h-20 w-full border text-sm font-bold", type === "usage" ? "border-blue-100 text-blue-700 hover:bg-blue-50" : "border-purple-100 text-purple-700 hover:bg-purple-50")}>
              {sending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />} Send now
            </Button>
          </div>
        </div>

        {saving && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving schedule
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportsSettingsPanel() {
  const {
    prefs,
    loading,
    saving,
    sending,
    status,
    loadPreferences,
    sendNow,
    handleUpdate,
    handleSectionToggle,
  } = useReportSettings();

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading report settings...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <DashboardHeader
        timeRange="24h"
        onTimeRangeChange={() => { }}
        onRefresh={() => loadPreferences({ forceRefresh: true })}
        isLoading={loading}
        lastUpdated=""
        showRegionSelector={false}
        showTimeRange={false}
        showAutoRefresh={false}
      />

      <div className="px-4 space-y-6">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#FFFFFF_0%,#EFF6FF_55%,#FFF7ED_100%)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit border-blue-100 bg-white/80 text-blue-700 hover:bg-white">Scheduled email intelligence</Badge>
              <div>
                <h1 className="text-3xl font-display font-extrabold tracking-tight text-slate-950">Email Reports</h1>
                <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                  Pick the cadence and CloudWatcher sends usage, recommendations, and AI infrastructure insight emails on the next matching calendar date.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="rounded-xl border border-white/80 bg-white/70 p-3 shadow-sm">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Usage next</p>
                <p className="mt-1 text-sm font-bold text-slate-950">{formatDate(calculateNextDelivery(prefs.usage))}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/70 p-3 shadow-sm">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Insights next</p>
                <p className="mt-1 text-sm font-bold text-slate-950">{formatDate(calculateNextDelivery(prefs.insight))}</p>
              </div>
            </div>
          </div>
        </div>

        {status && (
          <div className={cn("flex items-center gap-2 rounded-lg border p-3 text-sm", status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
            {status.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {status.message}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <ReportCard
            type="usage"
            title="Cloud Usage Report"
            description="Billing breakdown, spend projection, and top services for AWS, Azure, and GCP."
            icon={<Mail className="h-5 w-5 text-blue-600" />}
            prefs={prefs.usage}
            saving={saving === "usage"}
            sending={sending === "usage"}
            onUpdate={handleUpdate}
            onSectionToggle={handleSectionToggle}
            onSendNow={() => sendNow("usage")}
          />

          <ReportCard
            type="insight"
            title="AI Infrastructure Insights"
            description="Recommendations, diagnosis, and optimization actions from the Insights analysis."
            icon={<BrainCircuit className="h-5 w-5 text-purple-600" />}
            prefs={prefs.insight}
            saving={saving === "insight"}
            sending={sending === "insight"}
            onUpdate={handleUpdate}
            onSectionToggle={handleSectionToggle}
            onSendNow={() => sendNow("insight")}
          />
        </div>
      </div>
    </div>
  );
}
