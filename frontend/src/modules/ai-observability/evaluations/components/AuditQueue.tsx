"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Layers, Play, RefreshCw } from "@/icons";

import type { PendingLog } from "../types";

interface AuditQueueProps {
  loading: boolean;
  pendingLogs: PendingLog[];
  auditingRequestId: string | null;
  selectedJudgeProvider: string;
  setSelectedJudgeProvider: React.Dispatch<React.SetStateAction<string>>;
  customJudgeProviderName: string;
  setCustomJudgeProviderName: React.Dispatch<React.SetStateAction<string>>;
  selectedJudgeModel: string;
  setSelectedJudgeModel: React.Dispatch<React.SetStateAction<string>>;
  customJudgeApiKey: string;
  setCustomJudgeApiKey: React.Dispatch<React.SetStateAction<string>>;
  handleRunAudit: (requestId: string) => void;
}

export function AuditQueue({
  loading,
  pendingLogs,
  auditingRequestId,
  selectedJudgeProvider,
  setSelectedJudgeProvider,
  customJudgeProviderName,
  setCustomJudgeProviderName,
  selectedJudgeModel,
  setSelectedJudgeModel,
  customJudgeApiKey,
  setCustomJudgeApiKey,
  handleRunAudit,
}: AuditQueueProps) {
  return (
    <Card className="border border-border/80 bg-secondary/5">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Audit Queue
        </CardTitle>
        <CardDescription className="text-xs">
          Unaudited production request logs. Click run to invoke LLM-as-a-Judge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border border-border/60 bg-secondary/5 p-3 rounded-lg space-y-2.5">
          <div className="flex items-center gap-1.5 border-b border-border/60 pb-1.5 mb-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Judge Settings</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-muted-foreground uppercase">Provider</label>
              <Select
                value={selectedJudgeProvider}
                onValueChange={(val) => {
                  setSelectedJudgeProvider(val);
                  if (val === "gemini") setSelectedJudgeModel("gemini-2.5-flash");
                  else if (val === "openai") setSelectedJudgeModel("gpt-4o-mini");
                  else if (val === "anthropic") setSelectedJudgeModel("claude-3-5-haiku-latest");
                  else if (val === "custom") setSelectedJudgeModel("");
                }}
              >
                <SelectTrigger className="w-full h-8 text-xs font-mono">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini" className="text-xs font-mono">Gemini</SelectItem>
                  <SelectItem value="openai" className="text-xs font-mono">OpenAI</SelectItem>
                  <SelectItem value="anthropic" className="text-xs font-mono">Anthropic</SelectItem>
                  <SelectItem value="custom" className="text-xs font-mono">Custom/Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-muted-foreground uppercase">Model Name</label>
              <Input
                type="text"
                value={selectedJudgeModel}
                onChange={(e) => setSelectedJudgeModel(e.target.value)}
                placeholder={selectedJudgeProvider === "custom" ? "e.g. mistral-large-latest" : "e.g. gemini-2.0-flash"}
                className="w-full text-xs font-mono h-8 bg-background border border-border px-2 text-foreground"
              />
            </div>
          </div>

          {selectedJudgeProvider === "custom" && (
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-muted-foreground uppercase">Custom Provider Name / Endpoint URL</label>
              <Input
                type="text"
                value={customJudgeProviderName}
                onChange={(e) => setCustomJudgeProviderName(e.target.value)}
                placeholder="e.g. mistral, groq, deepseek, or https://..."
                className="w-full text-xs font-mono h-8 bg-background border border-border px-2 text-foreground"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-mono text-muted-foreground uppercase">
              Custom API Key <span className="text-[8px] text-destructive font-sans lowercase">(required)</span>
            </label>
            <Input
              type="password"
              value={customJudgeApiKey}
              onChange={(e) => setCustomJudgeApiKey(e.target.value)}
              placeholder="Used only for this audit run"
              className="w-full text-xs font-mono h-8 bg-background border border-border px-2 text-foreground"
            />
            <p className="text-[10px] leading-4 text-muted-foreground">
              Manual audits use this key with the selected provider, not saved AI Providers keys.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : pendingLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            Queue is empty! All recent logs have audits.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingLogs.map((log) => (
              <div key={log.requestId} className="flex items-center justify-between border border-border p-2.5 bg-secondary/10">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono font-semibold truncate">{log.endpoint || "/chat"}</span>
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground mt-0.5 truncate">{log.modelName}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRunAudit(log.requestId)}
                  disabled={auditingRequestId === log.requestId}
                  className="h-8 text-xs font-mono shrink-0 gap-1"
                >
                  {auditingRequestId === log.requestId ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  Audit
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
