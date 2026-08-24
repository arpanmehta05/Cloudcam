"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export interface PromptVersion {
  version: number;
  template: string;
  systemPrompt?: string;
  provider: string;
  model: string;
  endpoint?: string;
  temperature: number;
  maxTokens: number;
  createdAt: string;
}

export interface AiPrompt {
  _id: string;
  name: string;
  description?: string;
  variables: string[];
  versions: PromptVersion[];
  activeVersion: number;
  tags: string[];
}

export function usePlayground() {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>("new");
  const [name, setName] = useState("Untitled Prompt");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [template, setTemplate] = useState("");
  const [tags, setTags] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [variables, setVariables] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [modelA, setModelA] = useState({
    provider: "openai", model: "gpt-4o", endpoint: "", temperature: 0.7, maxTokens: 256,
    loading: false, output: "", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    latencyMs: 0, error: "",
  });

  const [modelB, setModelB] = useState({
    provider: "gemini", model: "gemini-2.0-flash", endpoint: "", temperature: 0.7, maxTokens: 256,
    loading: false, output: "", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    latencyMs: 0, error: "",
  });

  const [modelAKey, setModelAKey] = useState("");
  const [modelBKey, setModelBKey] = useState("");
  const [showModelAKey, setShowModelAKey] = useState(false);
  const [showModelBKey, setShowModelBKey] = useState(false);

  const [compareMode, setCompareMode] = useState(false);
  const [syncState, setSyncState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [templatesPanelOpen, setTemplatesPanelOpen] = useState(true);
  const [templateSearch, setTemplateSearch] = useState("");

  const isSelectingRef = useRef(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (modelA.provider.toLowerCase() !== "nvidia") {
        setModelAKey(localStorage.getItem(`playground_key_${modelA.provider}`) || "");
      } else {
        setModelAKey("");
      }
    }
  }, [modelA.provider]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (modelB.provider.toLowerCase() !== "nvidia") {
        setModelBKey(localStorage.getItem(`playground_key_${modelB.provider}`) || "");
      } else {
        setModelBKey("");
      }
    }
  }, [modelB.provider]);

  const handleModelAKeyChange = (val: string) => {
    setModelAKey(val);
    if (modelA.provider.toLowerCase() !== "nvidia") {
      localStorage.setItem(`playground_key_${modelA.provider}`, val);
    }
  };

  const handleModelBKeyChange = (val: string) => {
    setModelBKey(val);
    if (modelB.provider.toLowerCase() !== "nvidia") {
      localStorage.setItem(`playground_key_${modelB.provider}`, val);
    }
  };

  const loadPrompts = useCallback(async () => {
    try {
      const res = await authFetch("/api/prompts");
      const data = await res.json();
      if (data.success) setPrompts(data.prompts);
    } catch (err) {
      console.error("Failed to load prompt templates:", err);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  // Seed optional prompt data into the playground from session storage.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("rw-playground-seed");
      if (!raw) return;
      sessionStorage.removeItem("rw-playground-seed");
      const seed = JSON.parse(raw);
      isSelectingRef.current = true;
      setSelectedPromptId("new");
      if (typeof seed.name === "string" && seed.name) setName(seed.name);
      if (typeof seed.template === "string") setTemplate(seed.template);
      if (typeof seed.systemPrompt === "string") setSystemPrompt(seed.systemPrompt);
      setModelA((prev) => ({
        ...prev,
        provider: typeof seed.provider === "string" && seed.provider ? seed.provider : prev.provider,
        model: typeof seed.model === "string" && seed.model ? seed.model : prev.model,
        endpoint: typeof seed.endpoint === "string" ? seed.endpoint : prev.endpoint,
        temperature: typeof seed.temperature === "number" ? seed.temperature : prev.temperature,
        maxTokens: typeof seed.maxTokens === "number" ? seed.maxTokens : prev.maxTokens,
      }));
      setSyncState("unsaved");
      setTimeout(() => { isSelectingRef.current = false; }, 100);
    } catch {
      // Ignore malformed seeds; the playground still works without them.
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (isSelectingRef.current || !name) return;
    if (selectedPromptId === "new" && !template) return;

    setSyncState("unsaved");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSyncState("saving");
      try {
        const res = await authFetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedPromptId, name, description, template, systemPrompt,
            provider: modelA.provider, model: modelA.model, endpoint: modelA.endpoint,
            temperature: modelA.temperature, maxTokens: modelA.maxTokens,
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          }),
        });
        const data = await res.json();
        if (data.success && data.prompt) {
          setSyncState("saved");
          if (selectedPromptId === "new") {
            isSelectingRef.current = true;
            setSelectedPromptId(data.prompt._id);
            setTimeout(() => { isSelectingRef.current = false; }, 100);
          }
          loadPrompts();
        } else {
          setSyncState("unsaved");
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSyncState("unsaved");
      }
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedPromptId, name, description, systemPrompt, template, tags, modelA.provider, modelA.model, modelA.endpoint, modelA.temperature, modelA.maxTokens, loadPrompts]);

  // Extract variables on prompt changes
  useEffect(() => {
    const regex = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
    const found = new Set<string>();
    let match;
    const combined = (template || "") + " " + (systemPrompt || "");
    while ((match = regex.exec(combined)) !== null) {
      found.add(match[1]);
    }
    const newVars = Array.from(found);
    setVariables(newVars);
    setVariableValues((prev) => {
      const updated: Record<string, string> = {};
      newVars.forEach((v) => { updated[v] = prev[v] || ""; });
      return updated;
    });
  }, [template, systemPrompt]);

  const handleSelectPrompt = (id: string) => {
    isSelectingRef.current = true;
    setSelectedPromptId(id);
    if (id === "new") {
      setName("Untitled Prompt");
      setDescription("");
      setSystemPrompt("");
      setTemplate("");
      setTags("");
      setSyncState("saved");
      setTimeout(() => { isSelectingRef.current = false; }, 100);
    } else {
      const p = prompts.find((pr) => pr._id === id);
      if (p) {
        setName(p.name);
        setDescription(p.description || "");
        setTags(p.tags?.join(", ") || "");
        const latest = p.versions[p.versions.length - 1];
        if (latest) {
          setSystemPrompt(latest.systemPrompt || "");
          setTemplate(latest.template || "");
          setModelA((prev) => ({
            ...prev,
            provider: latest.provider || "openai",
            model: latest.model || "gpt-4o",
            endpoint: latest.endpoint || "",
            temperature: latest.temperature ?? 0.7,
            maxTokens: latest.maxTokens ?? 256,
          }));
        }
        setSyncState("saved");
        setTimeout(() => { isSelectingRef.current = false; }, 100);
      }
    }
  };

  const handleSavePrompt = async () => {
    if (!name || !template) {
      setSaveStatus("Name and template prompt are required.");
      return;
    }
    setSaveStatus("Saving...");
    try {
      const res = await authFetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPromptId, name, description, template, systemPrompt,
          provider: modelA.provider, model: modelA.model, endpoint: modelA.endpoint,
          temperature: modelA.temperature, maxTokens: modelA.maxTokens,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus("Saved successfully!");
        setSyncState("saved");
        await loadPrompts();
        setSelectedPromptId(data.prompt._id);
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setSaveStatus(`Failed: ${err.message}`);
    }
  };

  const handleDeletePrompt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this prompt template?")) return;
    try {
      const res = await authFetch(`/api/prompts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (selectedPromptId === id) handleSelectPrompt("new");
        loadPrompts();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const executeModel = async (
    config: typeof modelA,
    setConfig: React.Dispatch<React.SetStateAction<typeof modelA>>,
    apiKey: string
  ) => {
    setConfig((prev) => ({ ...prev, loading: true, error: "", output: "" }));
    try {
      const res = await authFetch("/api/prompts/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template, systemPrompt, provider: config.provider, model: config.model,
          endpoint: config.endpoint || undefined, temperature: config.temperature,
          topP: config.provider.toLowerCase() === "nvidia" ? 0.95 : undefined,
          maxTokens: config.maxTokens,
          reasoningBudget: config.provider.toLowerCase() === "nvidia" ? config.maxTokens : undefined,
          enableThinking: config.provider.toLowerCase() === "nvidia" ? true : undefined,
          variables: variableValues, apiKey: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig((prev) => ({
          ...prev, loading: false, output: data.text,
          usage: data.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: data.latencyMs || 0,
        }));
      } else {
        setConfig((prev) => ({ ...prev, loading: false, error: data.error || "Execution failed" }));
      }
    } catch (err: any) {
      const requestId = err?.details?.requestId;
      setConfig((prev) => ({
        ...prev, loading: false,
        error: `${err.message || "Execution request failed"}${requestId ? ` (Request ID: ${requestId})` : ""}`,
      }));
    }
  };

  const handleRunPlayground = () => {
    executeModel(modelA, setModelA, modelAKey);
    if (compareMode) {
      executeModel(modelB, setModelB, modelBKey);
    }
  };

  return {
    prompts, selectedPromptId, name, setName, description, setDescription,
    systemPrompt, setSystemPrompt, template, setTemplate, tags, setTags,
    saveStatus, variables, variableValues, setVariableValues, sidebarOpen, setSidebarOpen,
    modelA, setModelA, modelB, setModelB, modelAKey, modelBKey, handleModelAKeyChange, handleModelBKeyChange,
    showModelAKey, setShowModelAKey, showModelBKey, setShowModelBKey, compareMode, setCompareMode,
    syncState, templatesPanelOpen, setTemplatesPanelOpen, templateSearch, setTemplateSearch,
    handleSelectPrompt, handleSavePrompt, handleDeletePrompt, handleRunPlayground,
  };
}
