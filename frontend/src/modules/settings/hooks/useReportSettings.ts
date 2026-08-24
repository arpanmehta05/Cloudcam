import { useCallback, useEffect, useState } from "react";
import { settingsApi } from "../api/settings.api";
import { AllPreferences, PreferenceSet, ReportType } from "../types";

const DEFAULT_PREFS: PreferenceSet = {
  enabled: true,
  frequency: "weekly",
  lastSentAt: null,
  nextSendAt: null,
  dayOfWeek: 1,
  dayOfMonth: 1,
  timeOfDay: "09:00",
  sections: [],
};

const DEFAULT_SECTIONS: Record<ReportType, string[]> = {
  usage: ["summary", "topServices", "schedule"],
  insight: ["recommendations", "diagnosis", "optimizations", "alerts"],
};

export function useReportSettings() {
  const [prefs, setPrefs] = useState<AllPreferences>({
    usage: { ...DEFAULT_PREFS, sections: DEFAULT_SECTIONS.usage },
    insight: { ...DEFAULT_PREFS, sections: DEFAULT_SECTIONS.insight },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadPreferences = useCallback(async (options?: { forceRefresh?: boolean }) => {
    try {
      const data = await settingsApi.getReportPreferences(options);
      const usagePrefs = data.usage || {};
      const insightPrefs = data.insight || {};
      setPrefs({
        usage: { ...DEFAULT_PREFS, ...usagePrefs, sections: usagePrefs.sections ?? DEFAULT_SECTIONS.usage },
        insight: { ...DEFAULT_PREFS, ...insightPrefs, sections: insightPrefs.sections ?? DEFAULT_SECTIONS.insight },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const save = async (type: ReportType, next: PreferenceSet) => {
    setSaving(type);
    setStatus(null);
    try {
      const data = await settingsApi.saveReportPreferences(type, {
        ...next,
        sections: next.sections?.length ? next.sections : DEFAULT_SECTIONS[type],
      });
      setPrefs(prev => ({ ...prev, [type]: data.preferences }));
      setStatus({ type: "success", message: `${type === "usage" ? "Usage" : "AI Insight"} report schedule saved.` });
    } catch (e) {
      setStatus({ type: "error", message: "Failed to save preferences" });
    } finally {
      setSaving(null);
    }
  };

  const sendNow = async (type: ReportType) => {
    setSending(type);
    setStatus(null);
    try {
      const data = await settingsApi.sendTestReport(type);
      setPrefs(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          enabled: true,
          lastSentAt: new Date().toISOString(),
          nextSendAt: data.nextSendAt,
        },
      }));
      setStatus({ type: "success", message: `Report sent to ${data.recipient}.` });
    } catch (e) {
      setStatus({ type: "error", message: "Failed to send report" });
    } finally {
      setSending(null);
    }
  };

  const handleUpdate = (type: ReportType, field: keyof PreferenceSet, value: any) => {
    const next = { ...prefs[type], [field]: value };
    setPrefs(prev => ({ ...prev, [type]: next }));
    save(type, next);
  };

  const handleSectionToggle = (type: ReportType, section: string) => {
    const current = prefs[type].sections?.length ? prefs[type].sections : DEFAULT_SECTIONS[type];
    const hasSection = current.includes(section);
    const nextSections = hasSection
      ? current.filter(item => item !== section)
      : [...current, section];
    const next = {
      ...prefs[type],
      sections: nextSections.length ? nextSections : [section],
    };
    setPrefs(prev => ({ ...prev, [type]: next }));
    save(type, next);
  };

  return {
    prefs,
    loading,
    saving,
    sending,
    status,
    setStatus,
    loadPreferences,
    sendNow,
    handleUpdate,
    handleSectionToggle,
  };
}
