// Admin panel API client. Thin wrappers over the auth-aware fetch; all calls
// hit /api/admin/* which is guarded by requireSystemAdmin (+ 2FA) on the server.
import { authFetchJson } from "@/lib/auth-fetch";
import type {
  Plan,
  Feature,
  TenantSummary,
  TenantDetail,
  Overview,
  AuditEntry,
} from "./types";

const BASE = "/api/admin";

function post(url: string, body: unknown, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST") {
  return authFetchJson(url, undefined, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function fetchOverview(): Promise<Overview> {
  const res = await authFetchJson(`${BASE}/overview`);
  return res.overview as Overview;
}

export async function fetchPlans(): Promise<Plan[]> {
  const res = await authFetchJson(`${BASE}/plans`);
  return (res.plans as Plan[]) || [];
}

export async function fetchPlan(key: string): Promise<Plan> {
  const res = await authFetchJson(`${BASE}/plans/${encodeURIComponent(key)}`);
  return res.plan as Plan;
}

export async function createPlan(input: Partial<Plan>): Promise<Plan> {
  const res = await post(`${BASE}/plans`, input, "POST");
  return res.plan as Plan;
}

export async function updatePlan(key: string, input: Partial<Plan>): Promise<Plan> {
  const res = await post(`${BASE}/plans/${encodeURIComponent(key)}`, input, "PATCH");
  return res.plan as Plan;
}

export async function deletePlan(key: string): Promise<void> {
  await post(`${BASE}/plans/${encodeURIComponent(key)}`, undefined, "DELETE");
}

export async function fetchFeatures(): Promise<Feature[]> {
  const res = await authFetchJson(`${BASE}/features`);
  return (res.features as Feature[]) || [];
}

export async function createFeature(input: Partial<Feature>): Promise<Feature> {
  const res = await post(`${BASE}/features`, input, "POST");
  return res.feature as Feature;
}

export async function updateFeature(key: string, input: Partial<Feature>): Promise<Feature> {
  const res = await post(`${BASE}/features/${encodeURIComponent(key)}`, input, "PATCH");
  return res.feature as Feature;
}

export async function fetchTenants(): Promise<TenantSummary[]> {
  const res = await authFetchJson(`${BASE}/tenants`);
  return (res.tenants as TenantSummary[]) || [];
}

export async function fetchTenant(id: string): Promise<TenantDetail> {
  const res = await authFetchJson(`${BASE}/tenants/${encodeURIComponent(id)}`);
  return res as unknown as TenantDetail;
}

export async function assignTenantPlan(id: string, planKey: string): Promise<void> {
  await post(`${BASE}/tenants/${encodeURIComponent(id)}/plan`, { planKey }, "PUT");
}

export async function setTenantOverrides(
  id: string,
  overrides: { features?: Record<string, boolean | null>; limits?: Record<string, number | null> },
): Promise<void> {
  await post(`${BASE}/tenants/${encodeURIComponent(id)}/overrides`, overrides, "PUT");
}

export async function fetchAudit(): Promise<AuditEntry[]> {
  const res = await authFetchJson(`${BASE}/audit`);
  return (res.entries as AuditEntry[]) || [];
}
