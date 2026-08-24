import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiAlertRow } from "../api/types";

export type { AiAlertRow };

export async function getAlerts(status?: string): Promise<AiAlertRow[]> {
  const q = status ? `?status=${status}` : "";
  const data = await fetchAiJson<{ success: boolean; alerts: AiAlertRow[] }>(`${AI_OBSERVABILITY_BASE}/alerts${q}`);
  return data.alerts;
}

export async function patchAlert(id: string, status: "acknowledged" | "resolved"): Promise<AiAlertRow> {
  const data = await fetchAiJson<{ success: boolean; alert: AiAlertRow }>(`${AI_OBSERVABILITY_BASE}/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return data.alert;
}

export async function evaluateAlerts(): Promise<{ createdCount: number; alerts: AiAlertRow[]; unavailable?: boolean }> {
  try {
    const data = await fetchAiJson<{ success: boolean; createdCount: number; alerts: AiAlertRow[] }>(
      `${AI_OBSERVABILITY_BASE}/alerts/evaluate`,
      { method: "POST" },
    );
    return { createdCount: data.createdCount, alerts: data.alerts };
  } catch (error: any) {
    if (error?.status === 404 || error?.code === "ERR_RESPONSE_NOT_JSON") {
      const alerts = await getAlerts();
      return { createdCount: 0, alerts, unavailable: true };
    }
    throw error;
  }
}
