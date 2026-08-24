"use client";

import React from "react";
import { FormField } from "../SharedConfig";
import { Terminal, Copy, Check } from "@/icons";
import type { FieldDescriptor } from "@/lib/zod-form-fields";

interface GcpConfigProps {
  nodeData: any;
  nodeId?: string;
  values: Record<string, any>;
  errors: Record<string, string>;
  updateValue: (key: string, val: any) => void;
  visibleFields: FieldDescriptor[];
  vmInfo?: any;
  copied: boolean;
  handleCopySsh: (cmd: string) => void;
  sshUsername: string;
  setSshUsername: (val: string) => void;
  sshKeyName: string;
  setSshKeyName: (val: string) => void;
}

export function GcpConfig({
  nodeData,
  nodeId,
  values,
  errors,
  updateValue,
  visibleFields,
  vmInfo,
  copied,
  handleCopySsh,
  sshUsername,
  setSshUsername,
  sshKeyName,
  setSshKeyName,
}: GcpConfigProps) {
  return (
    <div className="space-y-5">
      {vmInfo?.public_ip && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left space-y-3 select-text">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold text-foreground">GCP Compute SSH Connect Command</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            The compute instance is active. Configure connection details below to generate the SSH command.
          </p>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Username
            </label>
            <input
              type="text"
              value={sshUsername}
              onChange={(e) => setSshUsername(e.target.value)}
              className="h-8 w-full rounded border border-border/50 bg-black/20 px-2 text-xs font-semibold text-foreground focus:border-blue-500 focus:outline-none"
              placeholder="e.g. cloudwatcher"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["cloudwatcher", "ubuntu", "admin", "root"].map((usr) => (
                <button
                  key={usr}
                  type="button"
                  onClick={() => setSshUsername(usr)}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-all border ${
                    sshUsername === usr
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-black/10 border-border/30 text-muted-foreground hover:text-foreground hover:bg-black/20"
                  }`}
                >
                  {usr}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Key File Name (.pem)
            </label>
            <div className="flex items-center rounded border border-border/50 bg-black/20 px-2 focus-within:border-blue-500">
              <input
                type="text"
                value={sshKeyName}
                onChange={(e) => setSshKeyName(e.target.value)}
                className="h-8 w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none"
                placeholder="e.g. my-key"
              />
              <span className="text-[10px] font-bold text-muted-foreground/60 select-none pr-1">.pem</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Generated Command
            </label>
            <div className="relative mt-2 flex items-center justify-between rounded-lg bg-black/40 border border-border/50 px-3.5 py-2 font-mono text-[10px] text-foreground select-all break-all pr-12">
              <span>{`ssh -i "${sshKeyName}.pem" ${sshUsername}@${vmInfo.public_ip}`}</span>
              <button
                onClick={() => handleCopySsh(`ssh -i "${sshKeyName}.pem" ${sshUsername}@${vmInfo.public_ip}`)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy to Clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {visibleFields.map((field) => (
        <FormField
          key={field.key}
          field={field}
          value={values[field.key] ?? field.defaultValue}
          error={errors[field.key] ?? null}
          onChange={(val) => updateValue(field.key, val)}
        />
      ))}
    </div>
  );
}
