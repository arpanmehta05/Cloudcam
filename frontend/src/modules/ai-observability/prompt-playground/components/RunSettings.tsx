"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Cpu, Eye, EyeOff } from "@/icons";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

interface ModelExecutionConfig {
  provider: string;
  model: string;
  endpoint: string;
  temperature: number;
  maxTokens: number;
  loading: boolean;
  output: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  error: string;
}

interface RunSettingsProps {
  compareMode: boolean;
  modelA: ModelExecutionConfig;
  setModelA: React.Dispatch<React.SetStateAction<ModelExecutionConfig>>;
  modelB: ModelExecutionConfig;
  setModelB: React.Dispatch<React.SetStateAction<ModelExecutionConfig>>;
  modelAKey: string;
  handleModelAKeyChange: (v: string) => void;
  modelBKey: string;
  handleModelBKeyChange: (v: string) => void;
  showModelAKey: boolean;
  setShowModelAKey: (v: boolean) => void;
  showModelBKey: boolean;
  setShowModelBKey: (v: boolean) => void;
}

export function RunSettings({
  compareMode,
  modelA,
  setModelA,
  modelB,
  setModelB,
  modelAKey,
  handleModelAKeyChange,
  modelBKey,
  handleModelBKeyChange,
  showModelAKey,
  setShowModelAKey,
  showModelBKey,
  setShowModelBKey,
}: RunSettingsProps) {
  return (
    <Card className="border border-border/80 bg-secondary/5 backdrop-blur-md rounded-xl shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border/40 bg-secondary/10 flex flex-row items-center gap-2 space-y-0">
        <Cpu className="w-4 h-4 text-indigo-400" />
        <CardTitle className="text-xs font-bold font-display uppercase tracking-wider text-foreground/85 font-sans">
          Run Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-5">
        {/* Model A Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-bold text-indigo-400 uppercase tracking-wide">
              Model A Config
            </span>
            <Badge
              variant="outline"
              className="text-[8px] font-sans font-bold px-1.5 py-0 border-indigo-400/30 text-indigo-400 uppercase"
            >
              Primary
            </Badge>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                Provider
              </label>
              <Input
                type="text"
                value={modelA.provider}
                onChange={(e) => {
                  const provider = e.target.value;
                  setModelA((prev) => ({
                    ...prev,
                    provider,
                    endpoint:
                      provider.toLowerCase() === "nvidia" && !prev.endpoint
                        ? NVIDIA_BASE_URL
                        : prev.endpoint,
                  }));
                }}
                placeholder="e.g. openai, gemini, anthropic"
                className="h-8 text-xs bg-secondary/15 border border-border/60 hover:bg-secondary/20 shadow-sm focus:outline-none focus:border-indigo-500 rounded px-2.5 transition-all text-foreground font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                Model
              </label>
              <Input
                type="text"
                value={modelA.model}
                onChange={(e) => {
                  const model = e.target.value;
                  setModelA((prev) => ({
                    ...prev,
                    model,
                    provider:
                      model.toLowerCase().startsWith("nvidia/") ||
                      model.toLowerCase().includes("nemotron")
                        ? "nvidia"
                        : prev.provider,
                    endpoint:
                      model.toLowerCase().startsWith("nvidia/") ||
                      model.toLowerCase().includes("nemotron")
                        ? prev.endpoint || NVIDIA_BASE_URL
                        : prev.endpoint,
                    temperature:
                      model.toLowerCase().startsWith("nvidia/") ||
                      model.toLowerCase().includes("nemotron")
                        ? 1
                        : prev.temperature,
                    maxTokens:
                      model.toLowerCase().startsWith("nvidia/") ||
                      model.toLowerCase().includes("nemotron")
                        ? 2_048
                        : prev.maxTokens,
                  }));
                }}
                placeholder="e.g. gpt-4o, gemini-2.5-flash"
                className="h-8 text-xs bg-secondary/15 border border-border/60 hover:bg-secondary/20 shadow-sm focus:outline-none focus:border-indigo-500 rounded px-2.5 transition-all text-foreground font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                Base URL / Endpoint
              </label>
              <Input
                type="url"
                value={modelA.endpoint}
                onChange={(e) => setModelA((prev) => ({ ...prev, endpoint: e.target.value }))}
                placeholder={
                  modelA.provider.toLowerCase() === "nvidia"
                    ? NVIDIA_BASE_URL
                    : "https://provider.example.com/v1"
                }
                className="h-8 w-full bg-secondary/15 px-2.5 text-xs text-foreground shadow-sm transition-all hover:bg-secondary/20 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Personal API Key
                </label>
                <span className="text-[9px] text-muted-foreground italic">Optional</span>
              </div>
              <div className="relative">
                <Input
                  type={showModelAKey ? "text" : "password"}
                  value={modelAKey}
                  onChange={(e) => handleModelAKeyChange(e.target.value)}
                  placeholder={
                    modelA.provider.toLowerCase() === "nvidia"
                      ? "nvapi-... or use saved key"
                      : "Provider API key"
                  }
                  className="h-8 text-xs bg-secondary/15 border border-border/60 hover:bg-secondary/20 shadow-sm focus:outline-none focus:border-indigo-500 rounded px-2.5 pr-8 transition-all text-foreground font-sans w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowModelAKey(!showModelAKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                  title={showModelAKey ? "Hide key" : "Show key"}
                >
                  {showModelAKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Temperature
                </label>
                <span className="text-[10px] text-foreground/80 font-bold bg-secondary/50 px-1.5 py-0.2 rounded border border-border/40 shadow-sm">
                  {modelA.temperature}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-muted-foreground/75">0</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={modelA.temperature}
                  onChange={(e) =>
                    setModelA((prev) => ({ ...prev, temperature: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md focus:outline-none"
                />
                <span className="text-[9px] text-muted-foreground/75">2</span>
              </div>
            </div>

            {/* Max Tokens Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Max Tokens
                </label>
                <span className="text-[10px] text-foreground/80 font-bold bg-secondary/50 px-1.5 py-0.2 rounded border border-border/40 shadow-sm">
                  {modelA.maxTokens}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-muted-foreground/75">64</span>
                <input
                  type="range"
                  min="64"
                  max={modelA.provider.toLowerCase() === "nvidia" ? "16384" : "8192"}
                  step="64"
                  value={modelA.maxTokens}
                  onChange={(e) =>
                    setModelA((prev) => ({ ...prev, maxTokens: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md focus:outline-none"
                />
                <span className="text-[9px] text-muted-foreground/75">
                  {modelA.provider.toLowerCase() === "nvidia" ? "16k" : "8k"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Model B Configuration */}
        {compareMode && (
          <div className="space-y-4 pt-4 border-t border-border/40 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold text-emerald-400 uppercase tracking-wide">
                Model B Config
              </span>
              <Badge
                variant="outline"
                className="text-[8px] font-sans font-bold px-1.5 py-0 border-emerald-400/30 text-emerald-400 uppercase"
              >
                Compare
              </Badge>
            </div>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Provider
                </label>
                <Input
                  type="text"
                  value={modelB.provider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    setModelB((prev) => ({
                      ...prev,
                      provider,
                      endpoint:
                        provider.toLowerCase() === "nvidia" && !prev.endpoint
                          ? NVIDIA_BASE_URL
                          : prev.endpoint,
                    }));
                  }}
                  placeholder="e.g. openai, gemini, anthropic"
                  className="h-8 text-xs bg-secondary/15 border border-border/60 hover:bg-secondary/20 shadow-sm focus:outline-none focus:border-indigo-500 rounded px-2.5 transition-all text-foreground font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Model
                </label>
                <Input
                  type="text"
                  value={modelB.model}
                  onChange={(e) => {
                    const model = e.target.value;
                    setModelB((prev) => ({
                      ...prev,
                      model,
                      provider:
                        model.toLowerCase().startsWith("nvidia/") ||
                        model.toLowerCase().includes("nemotron")
                          ? "nvidia"
                          : prev.provider,
                      endpoint:
                        model.toLowerCase().startsWith("nvidia/") ||
                        model.toLowerCase().includes("nemotron")
                          ? prev.endpoint || NVIDIA_BASE_URL
                          : prev.endpoint,
                      temperature:
                        model.toLowerCase().startsWith("nvidia/") ||
                        model.toLowerCase().includes("nemotron")
                          ? 1
                          : prev.temperature,
                      maxTokens:
                        model.toLowerCase().startsWith("nvidia/") ||
                        model.toLowerCase().includes("nemotron")
                          ? 2_048
                          : prev.maxTokens,
                    }));
                  }}
                  placeholder="e.g. gpt-4o, gemini-2.5-flash"
                  className="h-8 text-xs bg-secondary/15 border border-border/60 hover:bg-secondary/20 shadow-sm focus:outline-none focus:border-indigo-500 rounded px-2.5 transition-all text-foreground font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Base URL / Endpoint
                </label>
                <Input
                  type="url"
                  value={modelB.endpoint}
                  onChange={(e) => setModelB((prev) => ({ ...prev, endpoint: e.target.value }))}
                  placeholder={
                    modelB.provider.toLowerCase() === "nvidia"
                      ? NVIDIA_BASE_URL
                      : "https://provider.example.com/v1"
                }
                className="h-8 w-full bg-secondary/15 px-2.5 text-xs text-foreground shadow-sm transition-all hover:bg-secondary/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Personal API Key
                </label>
                <span className="text-[9px] text-muted-foreground italic">Optional</span>
              </div>
              <div className="relative">
                <Input
                  type={showModelBKey ? "text" : "password"}
                  value={modelBKey}
                  onChange={(e) => handleModelBKeyChange(e.target.value)}
                  placeholder={
                    modelB.provider.toLowerCase() === "nvidia"
                      ? "nvapi-... or use saved key"
                      : "Provider API key"
                  }
                  className="h-8 text-xs bg-secondary/15 border border-border/60 hover:bg-secondary/20 shadow-sm focus:outline-none focus:border-indigo-500 rounded px-2.5 pr-8 transition-all text-foreground font-sans w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowModelBKey(!showModelBKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                  title={showModelBKey ? "Hide key" : "Show key"}
                >
                  {showModelBKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Temperature
                </label>
                <span className="text-[10px] text-foreground/80 font-bold bg-secondary/50 px-1.5 py-0.2 rounded border border-border/40 shadow-sm">
                  {modelB.temperature}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-muted-foreground/75">0</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={modelB.temperature}
                  onChange={(e) =>
                    setModelB((prev) => ({ ...prev, temperature: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md focus:outline-none"
                />
                <span className="text-[9px] text-muted-foreground/75">2</span>
              </div>
            </div>

            {/* Max Tokens Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-sans font-medium text-muted-foreground/90">
                  Max Tokens
                </label>
                <span className="text-[10px] text-foreground/80 font-bold bg-secondary/50 px-1.5 py-0.2 rounded border border-border/40 shadow-sm">
                  {modelB.maxTokens}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-muted-foreground/75">64</span>
                <input
                  type="range"
                  min="64"
                  max={modelB.provider.toLowerCase() === "nvidia" ? "16384" : "8192"}
                  step="64"
                  value={modelB.maxTokens}
                  onChange={(e) =>
                    setModelB((prev) => ({ ...prev, maxTokens: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md focus:outline-none"
                />
                <span className="text-[9px] text-muted-foreground/75">
                  {modelB.provider.toLowerCase() === "nvidia" ? "16k" : "8k"}
                </span>
              </div>
            </div>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
