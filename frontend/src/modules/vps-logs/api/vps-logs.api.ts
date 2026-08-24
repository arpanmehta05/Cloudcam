import { authFetch } from "@/lib/auth-fetch";

export async function fetchAgents(options?: RequestInit) {
  const res = await authFetch("/api/vps-logs/agents", options);
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

export async function createAgent(name: string, vpcId?: string) {
  const res = await authFetch("/api/vps-logs/agents", {
    method: "POST",
    body: JSON.stringify({ name, vpcId }),
  });
  if (!res.ok) throw new Error("Failed to create agent");
  return res.json();
}

export async function updateAgent(agentId: string, updates: any) {
  const res = await authFetch(`/api/vps-logs/agents/${agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update agent");
  return res.json();
}

export async function deleteAgent(agentId: string) {
  const res = await authFetch(`/api/vps-logs/agents?agentId=${encodeURIComponent(agentId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete agent");
  return res;
}

export async function fetchSummary(queryString: string, options?: RequestInit) {
  const res = await authFetch(`/api/vps-logs/summary?${queryString}`, options);
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

export async function fetchAlarms(options?: RequestInit) {
  const res = await authFetch("/api/vps-logs/alarms", options);
  if (!res.ok) throw new Error("Failed to fetch alarms");
  return res.json();
}

export async function createAlarm(body: any) {
  const res = await authFetch("/api/vps-logs/alarms", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create alarm");
  return res.json();
}

export async function updateAlarm(id: string, updates: any) {
  const res = await authFetch(`/api/vps-logs/alarms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update alarm");
  return res.json();
}

export async function deleteAlarm(id: string) {
  const res = await authFetch(`/api/vps-logs/alarms/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete alarm");
  return res.json();
}

export async function updateAlertPolicy(body: any) {
  const res = await authFetch("/api/vps-logs/alert-policy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update alert policy");
  return res.json();
}

export async function clearRecentLogs(queryString: string) {
  const res = await authFetch(`/api/vps-logs/recent?${queryString}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to clear recent logs");
  return res.json();
}
