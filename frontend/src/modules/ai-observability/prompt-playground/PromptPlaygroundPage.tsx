"use client";

import React from "react";
import { usePlayground } from "./hooks/usePlayground";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Save,
  Layers,
  Trash2,
  Settings,
  Sparkles,
  Cloud,
  Check,
  Loader2,
  FolderOpen,
} from "@/icons";
import { PromptEditor } from "./components/PromptEditor";
import { ResultsComparison } from "./components/ResultsComparison";
import { RunSettings } from "./components/RunSettings";
import { VariablesPicker } from "./components/VariablesPicker";

export default function PromptPlaygroundPage() {
  const {
    prompts, selectedPromptId, name, setName, description, setDescription,
    systemPrompt, setSystemPrompt, template, setTemplate, tags, setTags,
    saveStatus, variables, variableValues, setVariableValues, sidebarOpen, setSidebarOpen,
    modelA, setModelA, modelB, setModelB, modelAKey, modelBKey, handleModelAKeyChange, handleModelBKeyChange,
    showModelAKey, setShowModelAKey, showModelBKey, setShowModelBKey, compareMode, setCompareMode,
    syncState, templatesPanelOpen, setTemplatesPanelOpen, templateSearch, setTemplateSearch,
    handleSelectPrompt, handleSavePrompt, handleDeletePrompt, handleRunPlayground,
  } = usePlayground();

  const getMiddleSpanClass = () => {
    const span = 12 - (templatesPanelOpen ? 3 : 0) - (sidebarOpen ? 3 : 0);
    if (span === 6) return "lg:col-span-6";
    if (span === 9) return "lg:col-span-9";
    return "lg:col-span-12";
  };

  return (
    <div className="space-y-6">
      {/* Header: Renaming and Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border/80 pb-5 gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xl font-display font-bold tracking-tight text-foreground bg-transparent border-b border-transparent hover:border-border/60 focus:border-indigo-500/80 focus:bg-secondary/10 px-2 py-0.5 rounded outline-none transition-all w-full max-w-md font-sans"
              placeholder="Untitled Prompt"
            />
            <div className="flex items-center text-muted-foreground" title={`Sync Status: ${syncState}`}>
              {syncState === "saving" ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              ) : syncState === "saved" ? (
                <div className="flex items-center gap-1 text-emerald-400">
                  <Cloud className="w-4 h-4" />
                  <Check className="w-2.5 h-2.5 -ml-1.5 mt-1 animate-pulse" />
                </div>
              ) : (
                <Cloud className="w-4 h-4 text-muted-foreground/60" />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTemplatesPanelOpen((prev) => !prev)}
            className={`h-9 text-xs gap-1.5 rounded-lg shadow-sm border-border/80 transition-all ${
              templatesPanelOpen ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "hover:bg-secondary/40 text-muted-foreground"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {templatesPanelOpen ? "Hide Templates" : "Show Templates"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSavePrompt}
            className="h-9 text-xs gap-1.5 border-border/80 hover:bg-secondary/40 rounded-lg shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            Save Template
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setCompareMode((prev) => !prev)}
            className={`h-9 text-xs gap-1.5 rounded-lg shadow-sm border-border/80 transition-all ${
              compareMode ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "hover:bg-secondary/40 text-muted-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {compareMode ? "Single Model" : "Compare Models"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className={`h-9 text-xs gap-1.5 rounded-lg shadow-sm border-border/80 transition-all ${
              sidebarOpen ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "hover:bg-secondary/40 text-muted-foreground"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            {sidebarOpen ? "Hide Settings" : "Configure Parameters"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-xs gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Simulate with AI
            <span className="bg-indigo-500 text-[8px] font-sans font-bold text-white px-1 py-0.2 rounded uppercase scale-90">Beta</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Templates */}
        {templatesPanelOpen && (
          <div className="lg:col-span-3 space-y-6">
            <Card className="border border-border/80 bg-secondary/5 backdrop-blur-md rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[700px]">
              <CardHeader className="py-3 px-4 border-b border-border/40 bg-secondary/10 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-400" />
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground/80 font-sans">Templates</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
                  {prompts.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-4 overflow-hidden">
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full h-8 text-xs font-medium bg-secondary/15 border border-border/60 rounded px-2.5 transition-all text-foreground focus:outline-none focus:border-indigo-500 font-sans"
                />
                <div className="overflow-y-auto space-y-1.5 flex-1 max-h-[500px] pr-1">
                  <button
                    onClick={() => handleSelectPrompt("new")}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                      selectedPromptId === "new" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "border-transparent text-indigo-400 hover:bg-secondary/40"
                    }`}
                  >
                    <span>+ New Template</span>
                  </button>
                  {prompts
                    .filter((p) => p.name.toLowerCase().includes(templateSearch.toLowerCase()))
                    .map((p) => (
                      <div
                        key={p._id}
                        onClick={() => handleSelectPrompt(p._id)}
                        className={`group w-full text-left px-3 py-2 rounded-lg text-xs border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          selectedPromptId === p._id ? "bg-secondary/40 text-foreground border-border/80 shadow-sm" : "border-transparent text-muted-foreground hover:bg-secondary/25 hover:text-foreground"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate text-foreground/90">{p.name}</div>
                          {p.description && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{p.description}</div>}
                        </div>
                        <button
                          onClick={(e) => handleDeletePrompt(p._id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-1 rounded hover:bg-secondary/50 shrink-0"
                          title="Delete Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Center Workspace */}
        <div className={`space-y-6 transition-all duration-300 ${getMiddleSpanClass()}`}>
          <PromptEditor
            name={name} setName={setName} description={description} setDescription={setDescription}
            systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt} template={template} setTemplate={setTemplate}
            tags={tags} setTags={setTags} saveStatus={saveStatus} compareMode={compareMode}
            modelA={modelA} modelB={modelB} handleSelectPrompt={handleSelectPrompt} handleRunPlayground={handleRunPlayground}
          />
          <ResultsComparison compareMode={compareMode} modelA={modelA} modelB={modelB} />
        </div>

        {/* Right Sidebar: Settings & Variables */}
        <div className={`space-y-6 lg:col-span-3 transition-all duration-300 ${sidebarOpen ? "block" : "hidden"}`}>
          <RunSettings
            compareMode={compareMode} modelA={modelA} setModelA={setModelA} modelB={modelB} setModelB={setModelB}
            modelAKey={modelAKey} handleModelAKeyChange={handleModelAKeyChange} modelBKey={modelBKey} handleModelBKeyChange={handleModelBKeyChange}
            showModelAKey={showModelAKey} setShowModelAKey={setShowModelAKey} showModelBKey={showModelBKey} setShowModelBKey={setShowModelBKey}
          />
          <VariablesPicker variables={variables} variableValues={variableValues} setVariableValues={setVariableValues} />
        </div>
      </div>
    </div>
  );
}
