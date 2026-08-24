// CloudWatcher Agent Watcher API client.
//
// Read endpoints hang off the authed /api/v1 CloudWatcher router. The ingest
// key is minted through the EXISTING AI-Observability creation path
// (setupApi.createIngestKey) — we do not duplicate that flow (PART 3.3).

import { authFetch } from "@/lib/auth-fetch";
import { setupApi, type AiIngestKey } from "@/modules/ai-observability";
import { CLOUDWATCHER_KEY_NAME } from "./constants";
import type { Agent, ReportDetail, ReportSummary } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`CloudWatcher API error ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function listAgents(): Promise<Agent[]> {
  const data = await getJson<{ success: boolean; agents: Agent[] }>("/api/v1/agents");
  return data.agents || [];
}

export async function listAgentReports(agentId: string): Promise<ReportSummary[]> {
  const data = await getJson<{ success: boolean; reports: ReportSummary[] }>(
    `/api/v1/agents/${encodeURIComponent(agentId)}/reports`,
  );
  return data.reports || [];
}

export async function getReport(reportId: string): Promise<ReportDetail> {
  const data = await getJson<{ success: boolean; report: ReportDetail }>(
    `/api/v1/reports/${encodeURIComponent(reportId)}`,
  );
  return data.report;
}

export async function downloadReportPdf(reportId: string): Promise<Blob> {
  const res = await authFetch(`/api/v1/reports/${encodeURIComponent(reportId)}/pdf?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`CloudWatcher PDF error ${res.status}: ${res.statusText}`);
  }
  return res.blob();
}

const REPORTS_SCOPE = "reports:write";

function hasReportsScope(key: AiIngestKey): boolean {
  return Array.isArray(key.scopes) && key.scopes.includes(REPORTS_SCOPE);
}

/**
 * Ensure the signed-in user has an ingest key that can submit CloudWatcher
 * reports, and return its plaintext token.
 *
 * The token is only ever revealed once — at creation — so we cannot reuse an
 * older key's secret. We therefore mint a dedicated reports:write key the first
 * time and cache its token locally (per token owner) so repeat visits reuse it
 * instead of piling up keys.
 */
export async function ensureReportsIngestKey(): Promise<{ token: string; prefix: string }> {
  const cached = readCachedKey();
  if (cached) {
    // Confirm the cached key still exists and is unrevoked.
    const keys = await setupApi.listIngestKeys();
    if (keys.some((k) => k.prefix === cached.prefix && hasReportsScope(k))) {
      return cached;
    }
    clearCachedKey();
  }

  const created = await setupApi.createIngestKey({
    name: CLOUDWATCHER_KEY_NAME,
    scopes: [REPORTS_SCOPE],
  });
  if (!created.token) {
    throw new Error("Ingest key was created but no token was returned.");
  }
  const result = { token: created.token, prefix: created.prefix };
  writeCachedKey(result);
  return result;
}

export async function revokeReportsIngestKey(prefix?: string | null): Promise<void> {
  const cached = readCachedKey();
  const targetPrefix = prefix || cached?.prefix;
  if (!targetPrefix) return;

  const keys = await setupApi.listIngestKeys();
  const key = keys.find((item) => item.prefix === targetPrefix && hasReportsScope(item));
  if (key) {
    await setupApi.revokeIngestKey(key.id);
  }
  clearCachedKey();
}

// ── local cache (scoped to the current auth token owner) ──────────────────
const CACHE_KEY = "cw_reports_ingest_key";

function cacheNamespace(): string {
  if (typeof window === "undefined") return "anon";
  // Bind the cached secret to the current session token so it never leaks
  // across accounts on a shared browser.
  return localStorage.getItem("rabbittize_token")?.slice(-12) || "anon";
}

function readCachedKey(): { token: string; prefix: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.ns !== cacheNamespace()) return null;
    if (typeof parsed?.token !== "string" || typeof parsed?.prefix !== "string") return null;
    return { token: parsed.token, prefix: parsed.prefix };
  } catch {
    return null;
  }
}

function writeCachedKey(value: { token: string; prefix: string }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ ...value, ns: cacheNamespace() }),
  );
}

function clearCachedKey() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CACHE_KEY);
}
