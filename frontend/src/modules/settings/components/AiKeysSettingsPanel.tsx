"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Loader2, RefreshCw } from "@/icons";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useAiKeysSettings } from "../hooks/useAiKeysSettings";

// Subcomponents
import { ApiKeyInput } from "./AiKeys/KeyForms";
import { OpenAiTab } from "./AiKeys/OpenAiTab";
import { PerKeyTab } from "./AiKeys/PerKeyTab";
import { AnthropicTab } from "./AiKeys/AnthropicTab";
import { GeminiTab } from "./AiKeys/GeminiTab";
import { PricingTab } from "./AiKeys/PricingTab";

export function AiKeysSettingsPanel() {
  const {
    keyStatus,
    openaiUsage,
    anthropicInfo,
    geminiInfo,
    perKeyData,
    perKeyLoading,
    loading,
    usageLoading,
    days,
    setDays,
    fetchStatus,
    fetchUsage,
    fetchPerKey,
    handleSaveKey,
    handleDeleteKey,
    completionChartData,
    costChartData,
    totalInputTokens,
    totalOutputTokens,
    totalRequests,
    totalCost,
  } = useAiKeysSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <DashboardHeader
        timeRange="24h"
        onTimeRangeChange={() => {}}
        onRefresh={() => {
          fetchStatus({ forceRefresh: true });
          fetchUsage({ forceRefresh: true });
        }}
        onAutoRefresh={() => {
          fetchStatus({ forceRefresh: true });
          fetchUsage({ forceRefresh: true, background: true });
        }}
        isLoading={usageLoading}
        lastUpdated=""
        showRegionSelector={false}
        showTimeRange={false}
      />

      <div className="px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 border border-primary/50 bg-card flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
                AI Platform Usage
              </h1>
              <p className="text-sm font-mono text-muted-foreground">
                Connect your OpenAI and Anthropic API keys to monitor usage,
                tokens, and costs
              </p>
            </div>
          </div>
        </div>

        {/* API Key Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ApiKeyInput
            provider="openai"
            label="OpenAI"
            placeholder="sk-proj-..."
            status={keyStatus.openai}
            onSave={(k) => handleSaveKey("openai", k)}
            onDelete={() => handleDeleteKey("openai")}
          />
          <ApiKeyInput
            provider="anthropic"
            label="Anthropic / Claude"
            placeholder="sk-ant-..."
            status={keyStatus.anthropic}
            onSave={(k) => handleSaveKey("anthropic", k)}
            onDelete={() => handleDeleteKey("anthropic")}
          />
          <ApiKeyInput
            provider="gemini"
            label="Google Gemini"
            placeholder="AIza..."
            status={keyStatus.gemini}
            onSave={(k) => handleSaveKey("gemini", k)}
            onDelete={() => handleDeleteKey("gemini")}
          />
          <ApiKeyInput
            provider="nvidia"
            label="NVIDIA NIM (Nemotron)"
            placeholder="nvapi-..."
            status={keyStatus.nvidia}
            onSave={(k) => handleSaveKey("nvidia", k)}
            onDelete={() => handleDeleteKey("nvidia")}
          />
        </div>

        {/* Main Tabs */}
        {(keyStatus.openai.connected ||
          keyStatus.anthropic.connected ||
          keyStatus.gemini.connected) && (
          <Tabs defaultValue="openai" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList>
                {keyStatus.openai.connected && (
                  <TabsTrigger
                    value="openai"
                    className="font-mono text-xs uppercase"
                  >
                    OpenAI
                  </TabsTrigger>
                )}
                {keyStatus.openai.connected && (
                  <TabsTrigger
                    value="per-key"
                    className="font-mono text-xs uppercase"
                  >
                    Per-Key
                  </TabsTrigger>
                )}
                {keyStatus.anthropic.connected && (
                  <TabsTrigger
                    value="anthropic"
                    className="font-mono text-xs uppercase"
                  >
                    Anthropic
                  </TabsTrigger>
                )}
                {keyStatus.gemini.connected && (
                  <TabsTrigger
                    value="gemini"
                    className="font-mono text-xs uppercase"
                  >
                    Gemini
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="pricing"
                  className="font-mono text-xs uppercase"
                >
                  Pricing
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                {[7, 14, 30].map((d) => (
                  <Button
                    key={d}
                    variant={days === d ? "default" : "outline"}
                    size="sm"
                    className="font-mono text-xs h-7"
                    onClick={() => setDays(d)}
                  >
                    {d}d
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchUsage({ forceRefresh: true })}
                  disabled={usageLoading}
                  className="h-7"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${usageLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>

            {/* ─── OpenAI Tab ─── */}
            {keyStatus.openai.connected && (
              <TabsContent value="openai" className="space-y-6">
                <OpenAiTab
                  openaiUsage={openaiUsage}
                  usageLoading={usageLoading}
                  days={days}
                  totalCost={totalCost}
                  totalInputTokens={totalInputTokens}
                  totalOutputTokens={totalOutputTokens}
                  totalRequests={totalRequests}
                  completionChartData={completionChartData}
                  costChartData={costChartData}
                />
              </TabsContent>
            )}

            {/* ─── Per-Key Usage Tab ─── */}
            {keyStatus.openai.connected && (
              <TabsContent value="per-key" className="space-y-6">
                <PerKeyTab
                  perKeyData={perKeyData}
                  perKeyLoading={perKeyLoading}
                  fetchPerKey={fetchPerKey}
                  days={days}
                />
              </TabsContent>
            )}

            {/* ─── Anthropic Tab ─── */}
            {keyStatus.anthropic.connected && (
              <TabsContent value="anthropic" className="space-y-6">
                <AnthropicTab
                  anthropicInfo={anthropicInfo}
                  keyStatus={keyStatus}
                />
              </TabsContent>
            )}

            {/* ─── Gemini Tab ─── */}
            {keyStatus.gemini.connected && (
              <TabsContent value="gemini" className="space-y-6">
                <GeminiTab
                  geminiInfo={geminiInfo}
                  keyStatus={keyStatus}
                />
              </TabsContent>
            )}

            {/* ─── Pricing Comparison Tab ─── */}
            <TabsContent value="pricing" className="space-y-6">
              <PricingTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
