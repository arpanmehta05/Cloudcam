"use client";

import React, { useState } from "react";
import { Plus, Trash2, ExternalLink, Copy, Check } from "@/icons";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FieldDescriptor } from "@/lib/zod-form-fields";

interface FormFieldProps {
  field: FieldDescriptor;
  value: any;
  error: string | null;
  onChange: (val: any) => void;
}

export function FormField({ field, value, error, onChange }: FormFieldProps) {
  const [activeTab, setActiveTab] = useState<"ingress" | "egress">("ingress");

  if (field.type === "rules") {
    const rulesList = Array.isArray(value) ? value : [];
    const inboundRules = rulesList.filter((r: any) => r.type === "ingress" || !r.type);
    const outboundRules = rulesList.filter((r: any) => r.type === "egress");
    const activeRules = activeTab === "ingress" ? inboundRules : outboundRules;

    const handleAddRule = () => {
      const newRule = { 
        type: activeTab, 
        fromPort: 80, 
        toPort: 80, 
        protocol: "tcp", 
        cidrBlocks: "0.0.0.0/0" 
      };
      onChange([...rulesList, newRule]);
    };

    const handleUpdateRule = (activeIdx: number, key: string, val: any) => {
      const targetRule = activeRules[activeIdx];
      const updated = rulesList.map((rule) => {
        if (rule === targetRule) {
          return { ...rule, [key]: val };
        }
        return rule;
      });
      onChange(updated);
    };

    const handleDeleteRule = (activeIdx: number) => {
      const targetRule = activeRules[activeIdx];
      const updated = rulesList.filter((rule) => rule !== targetRule);
      onChange(updated);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-extrabold text-[#0F172A] dark:text-white uppercase tracking-wider">
            {field.label}
          </Label>
          <button
            type="button"
            onClick={handleAddRule}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-600 transition-all hover:bg-blue-100 active:scale-95 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </button>
        </div>

        <div className="flex p-1 rounded-xl bg-slate-100/80 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-800/40 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("ingress")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 ${
              activeTab === "ingress"
                ? "bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:text-blue-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Inbound Rules
            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
              activeTab === "ingress"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {inboundRules.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("egress")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 ${
              activeTab === "egress"
                ? "bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:text-blue-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Outbound Rules
            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
              activeTab === "egress"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {outboundRules.length}
            </span>
          </button>
        </div>

        {activeRules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200/80 dark:border-slate-800/60 p-6 text-center bg-slate-50/50 dark:bg-slate-900/10">
            <p className="text-xs text-muted-foreground font-semibold">
              No {activeTab === "ingress" ? "Inbound" : "Outbound"} rules configured.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeRules.map((rule: any, activeIdx: number) => {
              let ruleSummary = "All Traffic";
              let badgeColor = "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400";
              if (rule.protocol === "tcp") {
                ruleSummary = rule.fromPort === rule.toPort ? `TCP: ${rule.fromPort}` : `TCP: ${rule.fromPort}-${rule.toPort}`;
                badgeColor = "bg-blue-100/80 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400";
              } else if (rule.protocol === "udp") {
                ruleSummary = rule.fromPort === rule.toPort ? `UDP: ${rule.fromPort}` : `UDP: ${rule.fromPort}-${rule.toPort}`;
                badgeColor = "bg-purple-100/80 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400";
              } else if (rule.protocol === "icmp") {
                ruleSummary = "ICMP";
                badgeColor = "bg-amber-100/80 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400";
              }

              return (
                <div
                  key={activeIdx}
                  className="relative flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/50 p-4 shadow-sm transition-all dark:border-slate-800/40 dark:bg-[#07111F]/50 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border border-current/10 ${badgeColor}`}>
                      {ruleSummary}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(activeIdx)}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Protocol</Label>
                      <Select
                        value={rule.protocol || "tcp"}
                        onValueChange={(val) => handleUpdateRule(activeIdx, "protocol", val)}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-lg border-[#CBD5E1] bg-white font-semibold text-[#0F172A] shadow-sm dark:border-[#334155] dark:bg-[#0B1728] dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[350] w-[140px] bg-white dark:bg-[#0B1728] border border-border">
                          <SelectItem value="tcp" className="text-xs font-semibold">TCP</SelectItem>
                          <SelectItem value="udp" className="text-xs font-semibold">UDP</SelectItem>
                          <SelectItem value="icmp" className="text-xs font-semibold">ICMP</SelectItem>
                          <SelectItem value="all" className="text-xs font-semibold">All Traffic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source CIDR</Label>
                      <input
                        type="text"
                        value={rule.cidrBlocks || ""}
                        onChange={(e) => handleUpdateRule(activeIdx, "cidrBlocks", e.target.value)}
                        placeholder="e.g. 0.0.0.0/0"
                        className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm outline-none focus:border-primary dark:border-[#334155] dark:bg-[#0B1728] dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">From Port</Label>
                      <input
                        type="number"
                        value={rule.fromPort ?? ""}
                        disabled={rule.protocol === "all" || rule.protocol === "icmp"}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateRule(activeIdx, "fromPort", val === "" ? "" : Number(val));
                        }}
                        placeholder="80"
                        min={1}
                        max={65535}
                        className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm outline-none focus:border-primary disabled:opacity-50 dark:border-[#334155] dark:bg-[#0B1728] dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">To Port</Label>
                      <input
                        type="number"
                        value={rule.toPort ?? ""}
                        disabled={rule.protocol === "all" || rule.protocol === "icmp"}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateRule(activeIdx, "toPort", val === "" ? "" : Number(val));
                        }}
                        placeholder="80"
                        min={1}
                        max={65535}
                        className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm outline-none focus:border-primary disabled:opacity-50 dark:border-[#334155] dark:bg-[#0B1728] dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && <p className="text-[11px] font-semibold text-[#EF4444]">{error}</p>}
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 shadow-sm dark:border-[#24344D] dark:bg-[#07111F]">
        <Label className="text-sm font-bold text-[#0F172A] cursor-pointer dark:text-white" htmlFor={`field-${field.key}`}>
          {field.label}
        </Label>
        <button
          id={`field-${field.key}`}
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#DBEAFE] dark:focus:ring-[#1D4ED8]/40 ${
            value ? "bg-[#22C55E]" : "bg-[#CBD5E1] dark:bg-[#334155]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow-sm transition duration-200 ${
              value ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    );
  }

  if (field.type === "select" && field.options && field.options.length > 0) {
    const currentValue = value != null && value !== "" ? String(value) : String(field.options[0].value);
    const dropdownOptions = field.options.map((opt) => ({
      value: String(opt.value),
      label: opt.label,
    }));
    return (
      <div className="space-y-2">
        <Label htmlFor={`field-${field.key}`} className="text-sm font-bold text-[#0F172A] dark:text-white">
          {field.label}
        </Label>
        <CustomDropdown
          value={currentValue}
          onChange={(v) => {
            const opt = field.options?.find((o) => String(o.value) === v);
            onChange(opt?.value ?? v);
          }}
          options={dropdownOptions}
          placeholder={field.placeholder || "Select option..."}
          searchable={field.key !== "repositoryMode"}
        />
        {error && <p className="text-[11px] font-semibold text-[#EF4444]">{error}</p>}
      </div>
    );
  }
  
  if (field.key === "policy" || field.key === "code") {
    let generatorUrl = "https://awspolicygen.s3.amazonaws.com/policygen.html";
    let generatorLabel = "AWS Policy Generator";
    
    if (field.key === "code") {
      generatorUrl = "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html";
      generatorLabel = "Lambda Developer Guide";
    } else if (field.provider === "azure") {
      generatorUrl = "https://learn.microsoft.com/en-us/azure/governance/policy/tutorials/create-custom-policy-definition";
      generatorLabel = "Azure Policy Guide";
    } else if (field.provider === "gcp") {
      generatorUrl = "https://console.cloud.google.com/iam-admin/troubleshooter";
      generatorLabel = "GCP Policy Troubleshooter";
    }

    let defaultPlaceholder = '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Principal": "*",\n      "Action": "s3:GetObject",\n      "Resource": "arn:aws:s3:::example-bucket/*"\n    }\n  ]\n}';
    if (field.key === "code") {
      defaultPlaceholder = "exports.handler = async (event) => {\n  console.log('Event: ', event);\n  return {\n    statusCode: 200,\n    body: JSON.stringify('Hello World!')\n  };\n};";
    } else if (field.provider === "azure") {
      defaultPlaceholder = '{\n  "properties": {\n    "mode": "All",\n    "policyRule": {\n      "if": { "field": "tags", "exists": "false" },\n      "then": { "effect": "deny" }\n    }\n  }\n}';
    } else if (field.provider === "gcp") {
      defaultPlaceholder = '{\n  "bindings": [\n    {\n      "role": "roles/storage.objectViewer",\n      "members": ["allUsers"]\n    }\n  ]\n}';
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`field-${field.key}`} className="text-sm font-bold text-[#0F172A] dark:text-white">
            {field.label}
          </Label>
          <div className="flex items-center gap-3">
            {field.key === "code" && (
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline dark:text-emerald-400 cursor-pointer">
                <Plus className="h-3.5 w-3.5" />
                Upload File
                <input
                  type="file"
                  accept=".js,.mjs,.py"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const text = evt.target?.result;
                      if (typeof text === "string") {
                        onChange(text);
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            )}
            <a
              href={generatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3" />
              {generatorLabel}
            </a>
          </div>
        </div>
        <textarea
          id={`field-${field.key}`}
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultPlaceholder}
          rows={10}
          className="w-full min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-mono text-[#0F172A] shadow-sm transition-colors outline-none placeholder:text-[#94A3B8] focus:border-primary focus:ring-4 focus:ring-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:bg-[#0B1728] dark:text-white dark:focus:border-[#3B82F6] dark:focus:ring-[#1D4ED8]/30"
        />
        {error && <p className="text-[11px] font-semibold text-[#EF4444]">{error}</p>}
      </div>
    );
  }

  const inputValue = field.type === "number"
    ? (typeof value === "number" ? value : Number(value) || 0)
    : (typeof value === "string" ? value : String(value ?? ""));

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.key}`} className="text-sm font-bold text-[#0F172A] dark:text-white">
        {field.label}
      </Label>
      <input
        id={`field-${field.key}`}
        type={field.type === "number" ? "number" : "text"}
        value={inputValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === "number") {
            onChange(raw === "" ? "" : Number(raw));
          } else {
            onChange(raw);
          }
        }}
        placeholder={field.placeholder ?? undefined}
        min={field.type === "number" && field.min != null ? field.min : undefined}
        max={field.type === "number" && field.max != null ? field.max : undefined}
        step={field.type === "number" && field.step != null ? field.step : undefined}
        className="h-10 w-full min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] shadow-sm transition-colors outline-none placeholder:text-[#94A3B8] focus:border-primary focus:ring-4 focus:ring-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:bg-[#0B1728] dark:text-white dark:focus:border-[#3B82F6] dark:focus:ring-[#1D4ED8]/30"
      />
      {error && <p className="text-[11px] font-semibold text-[#EF4444]">{error}</p>}
    </div>
  );
}
