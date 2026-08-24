"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Layers, RefreshCw, ChevronDown, Plus, Play } from "@/icons";

interface ModelExecutionState {
  loading: boolean;
}

interface PromptEditorProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  template: string;
  setTemplate: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  saveStatus: string | null;
  compareMode: boolean;
  modelA: ModelExecutionState;
  modelB: ModelExecutionState;
  handleSelectPrompt: (id: string) => void;
  handleRunPlayground: () => void;
}

export function PromptEditor({
  name,
  setName,
  description,
  setDescription,
  systemPrompt,
  setSystemPrompt,
  template,
  setTemplate,
  tags,
  setTags,
  saveStatus,
  compareMode,
  modelA,
  modelB,
  handleSelectPrompt,
  handleRunPlayground,
}: PromptEditorProps) {
  return (
    <Card className="border border-border/80 bg-secondary/5 backdrop-blur-md rounded-xl shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-5 border-b border-border/40 bg-secondary/10 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Conversation
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 hover:bg-secondary/40 text-muted-foreground rounded-full"
            onClick={() => handleSelectPrompt("new")}
            title="Reset Conversation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <span className="bg-indigo-500/10 text-indigo-400 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase">
            Prompt Studio
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Metadata input row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-border/40 bg-secondary/5">
          <div className="space-y-1">
            <label className="text-[9px] font-semibold uppercase text-muted-foreground tracking-widest font-bold">
              Template Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. support_classifier"
              className="h-8 text-xs bg-secondary/10 border-border/60 focus:border-indigo-500 rounded-md shadow-sm font-medium"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[9px] font-semibold uppercase text-muted-foreground tracking-widest font-bold">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the usage of this prompt template..."
              className="h-8 text-xs bg-secondary/10 border-border/60 focus:border-indigo-500 rounded-md shadow-sm font-medium"
            />
          </div>
        </div>

        {/* Message Thread */}
        <div className="p-5 space-y-5">
          {/* SYSTEM instructions bubble */}
          <div className="border border-border/60 rounded-xl bg-secondary/10 shadow-sm hover:border-border/80 transition-colors">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/45 bg-secondary/20 rounded-t-xl">
              <button className="flex items-center gap-1.5 text-[10px] font-bold text-foreground/80 hover:text-foreground cursor-default">
                <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[9px] border border-indigo-500/20">
                  SYSTEM
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <span className="text-[8px] text-muted-foreground tracking-wider uppercase">
                Instructions
              </span>
            </div>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter the system message here..."
              className="min-h-[90px] w-full text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 p-4 leading-relaxed resize-y focus:outline-none font-medium"
            />
          </div>

          {/* USER prompt template bubble */}
          <div className="border border-border/60 rounded-xl bg-secondary/10 shadow-sm hover:border-border/80 transition-colors">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/45 bg-secondary/20 rounded-t-xl">
              <button className="flex items-center gap-1.5 text-[10px] font-bold text-foreground/80 hover:text-foreground cursor-default">
                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[9px] border border-emerald-500/20">
                  USER
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <span className="text-[8px] text-muted-foreground tracking-wider uppercase">
                User Request Template
              </span>
            </div>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Enter the user message here... Use {{variable}} to inject values."
              className="min-h-[140px] w-full text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 p-4 leading-relaxed resize-y focus:outline-none font-medium"
            />
          </div>
        </div>

        {/* Tags Input & Action Row */}
        <div className="px-5 pb-5 pt-3 border-t border-border/30 bg-secondary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <label className="text-[9px] font-semibold uppercase text-muted-foreground tracking-widest font-bold">
              Tags (Comma-Separated)
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. support, classifier, prod-ready"
              className="h-8 text-xs bg-secondary/10 border-border/60 max-w-sm rounded-md shadow-sm font-medium"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <button className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Add message
            </button>
            <span className="text-muted-foreground/30 font-light">|</span>
            {saveStatus && (
              <span className="text-[10px] text-muted-foreground animate-pulse mr-2">
                {saveStatus}
              </span>
            )}
            <Button
              onClick={handleRunPlayground}
              disabled={modelA.loading || (compareMode && modelB.loading) || !template}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 h-9 font-semibold px-6 rounded-lg shadow-[0_0_12px_rgba(79,70,229,0.3)] transition-all cursor-pointer font-sans"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {compareMode ? "Run Comparison" : "Run Model"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
