import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { Anomaly, DailySummary, ForecastResult, WeeklySummary } from "../api/types";

export type { Anomaly, DailySummary, ForecastResult, WeeklySummary };

export async function getForecast(): Promise<ForecastResult> {
  const data = await fetchAiJson<{ success: boolean; forecast: ForecastResult }>(`${AI_OBSERVABILITY_BASE}/forecast`);
  return data.forecast;
}

export async function getDailySummary(date?: string): Promise<DailySummary> {
  const q = date ? `?date=${date}` : "";
  const data = await fetchAiJson<{ success: boolean; summary: DailySummary }>(`${AI_OBSERVABILITY_BASE}/summary/daily${q}`);
  return data.summary;
}

export async function getWeeklySummary(): Promise<WeeklySummary> {
  const data = await fetchAiJson<{ success: boolean; summary: WeeklySummary }>(`${AI_OBSERVABILITY_BASE}/summary/weekly`);
  return data.summary;
}

export async function getAnomalies(): Promise<Anomaly[]> {
  const data = await fetchAiJson<{ success: boolean; anomalies: Anomaly[] }>(`${AI_OBSERVABILITY_BASE}/anomalies`);
  return data.anomalies;
}
