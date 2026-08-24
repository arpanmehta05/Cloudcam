"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchEvaluationsDashboard, runEvaluationAudit } from "../api";
import type {
  AiEvaluation,
  EvaluationErrorModalState,
  EvaluationStats,
  PendingLog,
} from "../types";

const DEFAULT_STATS: EvaluationStats = {
  totalCount: 0,
  avgScore: 0,
  passRate: 0,
  metricsBreakdown: { grounding: 0, safety: 0, relevance: 0, coherence: 0 },
};

const DEFAULT_ERROR_MODAL: EvaluationErrorModalState = {
  isOpen: false,
  title: "",
  message: "",
};

export function useEvaluationsDashboard() {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<AiEvaluation[]>([]);
  const [stats, setStats] = useState<EvaluationStats>(DEFAULT_STATS);
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [expandedEvalId, setExpandedEvalId] = useState<string | null>(null);
  const [auditingRequestId, setAuditingRequestId] = useState<string | null>(null);
  const [selectedJudgeProvider, setSelectedJudgeProvider] = useState<string>("gemini");
  const [customJudgeProviderName, setCustomJudgeProviderName] = useState<string>("");
  const [selectedJudgeModel, setSelectedJudgeModel] = useState<string>("gemini-2.5-flash");
  const [customJudgeApiKey, setCustomJudgeApiKey] = useState<string>("");
  const [errorModal, setErrorModal] =
    useState<EvaluationErrorModalState>(DEFAULT_ERROR_MODAL);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEvaluationsDashboard();
      if (data.success) {
        setEvaluations(data.evaluations || []);
        setStats(data.stats || DEFAULT_STATS);
        setPendingLogs(data.pendingLogs || []);
      }
    } catch (err) {
      console.error("Failed to load evaluations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunAudit = async (requestId: string) => {
    const providerToSend =
      selectedJudgeProvider === "custom"
        ? customJudgeProviderName.trim()
        : selectedJudgeProvider;
    const modelToSend = selectedJudgeModel.trim();
    const apiKeyToSend = customJudgeApiKey.trim();

    if (!providerToSend) {
      setErrorModal({
        isOpen: true,
        title: "Judge Provider Required",
        requestId,
        message: "Select a judge provider or enter a custom provider name/endpoint.",
        isKeyError: false,
        isRateLimit: false,
      });
      return;
    }

    if (!modelToSend) {
      setErrorModal({
        isOpen: true,
        title: "Judge Model Required",
        requestId,
        message: "Enter the model name for the selected judge provider.",
        isKeyError: false,
        isRateLimit: false,
      });
      return;
    }

    if (!apiKeyToSend && !isLocalJudgeProvider(providerToSend)) {
      setErrorModal({
        isOpen: true,
        title: "Judge API Key Required",
        requestId,
        message: "Enter the API key in the Evaluations page Custom API Key field. This audit does not use saved AI Providers keys.",
        isKeyError: true,
        isRateLimit: false,
      });
      return;
    }

    setAuditingRequestId(requestId);
    try {
      const data = await runEvaluationAudit({
        requestId,
        judgeProvider: providerToSend,
        judgeModel: modelToSend,
        judgeApiKey: apiKeyToSend,
      });
      if (data.success) {
        await fetchData();
      } else {
        setErrorModal({
          isOpen: true,
          title: "Audit Execution Failed",
          requestId,
          ...classifyError(data.error || "Unknown error occurred"),
        });
      }
    } catch (err: any) {
      console.error("Failed to run audit:", err);
      setErrorModal({
        isOpen: true,
        title: "Audit Request Failed",
        requestId,
        ...classifyError(err.message || String(err)),
      });
    } finally {
      setAuditingRequestId(null);
    }
  };

  return {
    loading,
    evaluations,
    stats,
    pendingLogs,
    expandedEvalId,
    setExpandedEvalId,
    auditingRequestId,
    selectedJudgeProvider,
    setSelectedJudgeProvider,
    customJudgeProviderName,
    setCustomJudgeProviderName,
    selectedJudgeModel,
    setSelectedJudgeModel,
    customJudgeApiKey,
    setCustomJudgeApiKey,
    errorModal,
    setErrorModal,
    fetchData,
    handleRunAudit,
  };
}

function isLocalJudgeProvider(provider: string) {
  const normalized = provider.toLowerCase().trim();
  return (
    normalized === "ollama" ||
    normalized === "lmstudio" ||
    normalized === "localai" ||
    normalized.startsWith("http://localhost") ||
    normalized.startsWith("http://127.0.0.1")
  );
}

// Turn a raw provider error (often a JSON blob like
// [{"error":{"code":429,"message":"You exceeded your current quota..."}}]) into a
// clean human message plus the flags the dialog uses to show the right guidance.
function classifyError(raw: string): {
  message: string;
  isKeyError: boolean;
  isRateLimit: boolean;
} {
  let message = raw;
  try {
    const parsed = JSON.parse(raw);
    const err = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    if (err?.message) message = String(err.message);
  } catch {
    // Not JSON — keep the raw string.
  }

  const isRateLimit =
    /\b429\b|quota|rate[\s-]?limit|resource[_\s-]?exhausted|exceeded/i.test(raw);
  const isKeyError =
    !isRateLimit &&
    /key|api-key|apikey|unauthorized|forbidden|permission|invalid authorization|\b401\b|\b403\b|scopes/i.test(
      raw,
    );

  return { message, isKeyError, isRateLimit };
}
