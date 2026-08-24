import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { ScoreConfig, ScoreDataType } from "../api/types";

export type { ScoreConfig, ScoreDataType };

export async function listScoreConfigs(): Promise<ScoreConfig[]> {
  const data = await fetchAiJson<{ success: boolean; scoreConfigs: ScoreConfig[] }>(`${AI_OBSERVABILITY_BASE}/score-configs`);
  return data.scoreConfigs || [];
}

export async function createScoreConfig(input: Partial<ScoreConfig>): Promise<ScoreConfig> {
  const data = await fetchAiJson<{ success: boolean; scoreConfig: ScoreConfig }>(`${AI_OBSERVABILITY_BASE}/score-configs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.scoreConfig;
}

export function getScoreAnalytics() {
  return fetchAiJson<{ success: boolean; distributions: unknown[]; trends: unknown[] }>(`${AI_OBSERVABILITY_BASE}/scores/analytics`);
}

export const scoresApi = {
  createScoreConfig,
  listScoreConfigs,
};
