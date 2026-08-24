import type { AuditEntry } from "./types";

/** Human phrasing for an audit action, e.g. "created plan pro". */
export function formatAction(e: AuditEntry): string {
  const target = e.targetId ? ` ${e.targetId}` : "";
  const map: Record<string, string> = {
    "plan.create": `created plan${target}`,
    "plan.update": `updated plan${target}`,
    "plan.delete": `deleted plan${target}`,
    "feature.create": `registered feature${target}`,
    "feature.update": `updated feature${target}`,
    "tenant.plan.assign": `assigned plan to tenant${target}`,
    "tenant.override.set": `set overrides for tenant${target}`,
  };
  return map[e.action] || `${e.action}${target}`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Render a limit value; null/undefined means unlimited. */
export function limitLabel(v: number | null | undefined): string {
  return v === null || v === undefined ? "∞" : v.toLocaleString();
}
