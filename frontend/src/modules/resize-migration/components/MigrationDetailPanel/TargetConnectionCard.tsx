"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, Copy, Check } from "@/icons";
import type { MigrationJob } from "../../types";

type AccessMode = "cloud_only" | "deep_inspection";
type AccessMethod = "ssh" | "ssm";

interface TargetConnectionCardProps {
  activeJob: MigrationJob;
  customSshUsername: string;
  setCustomSshUsername: (u: string) => void;
  customSshKeyName: string;
  setCustomSshKeyName: (k: string) => void;
  targetHost: string | null;
  targetHostLabel: string;
  generatedSshCommand: string;
  copiedSsh: boolean;
  handleCopyText: (text: string, isSsh?: boolean) => void;
  accessMode: AccessMode;
  setAccessMode: (mode: AccessMode) => void;
  accessMethod: AccessMethod;
  setAccessMethod: (method: AccessMethod) => void;
  sshUsername: string;
  setSshUsername: (u: string) => void;
  sshPort: number;
  setSshPort: (p: number) => void;
  sshKey: string;
  setSshKey: (key: string) => void;
  handleConfigureAccess: () => void;
  isConfiguringAccess: boolean;
}

export function TargetConnectionCard({
  activeJob,
  customSshUsername,
  setCustomSshUsername,
  customSshKeyName,
  setCustomSshKeyName,
  targetHost,
  targetHostLabel,
  generatedSshCommand,
  copiedSsh,
  handleCopyText,
  accessMode,
  setAccessMode,
  accessMethod,
  setAccessMethod,
  sshUsername,
  setSshUsername,
  sshPort,
  setSshPort,
  sshKey,
  setSshKey,
  handleConfigureAccess,
  isConfiguringAccess,
}: TargetConnectionCardProps) {
  const suggestedUsers = activeJob.provider === "aws"
    ? ["ec2-user", "ubuntu", "admin", "root", "centos", "debian"]
    : activeJob.provider === "azure"
    ? ["azureuser", "ubuntu", "admin", "root"]
    : ["cloudwatcher", "ubuntu", "admin", "root"];

  return (
    <Card className="border-[#e8eaee] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0A1220] overflow-hidden select-text">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 font-sans">
            <Key className="h-4.5 w-4.5 text-blue-500" /> Target Connection (SSH)
          </CardTitle>
          {!targetHost ? (
            <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-600 bg-amber-50/50">
              Awaiting IP
            </Badge>
          ) : (
            <Badge className="text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white">
              Ready
            </Badge>
          )}
        </div>
        <CardDescription className="text-[11px] font-semibold text-slate-500 mt-1">
          Use your local terminal and private key (.pem) to connect to the new server.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-[11.5px]">
          <div className="flex flex-col gap-1.5">
            <span className="font-extrabold text-[#64748b] text-[10px] uppercase tracking-wider">
              Login User
            </span>
            <input
              type="text"
              value={customSshUsername}
              onChange={(e) => setCustomSshUsername(e.target.value)}
              className="h-8 w-full rounded border border-slate-200 bg-white dark:bg-black/20 dark:border-border/50 px-2 text-xs font-semibold text-foreground focus:border-blue-500 focus:outline-none"
              placeholder="e.g. ubuntu"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {suggestedUsers.map((usr) => (
                <button
                  key={usr}
                  type="button"
                  onClick={() => setCustomSshUsername(usr)}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-all border cursor-pointer ${
                    customSshUsername === usr
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-black/10 border-border/30 text-muted-foreground hover:text-foreground hover:bg-black/20"
                  }`}
                >
                  {usr}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-extrabold text-[#64748b] text-[10px] uppercase tracking-wider">
              Target Host
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-350 truncate max-w-[180px]">
              {targetHostLabel}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-extrabold text-[#64748b] text-[10px] uppercase tracking-wider">
              Private Key File
            </span>
            <div className="flex items-center rounded border border-slate-200 bg-white dark:bg-black/20 dark:border-border/50 px-2 focus-within:border-blue-500">
              <input
                type="text"
                value={customSshKeyName}
                onChange={(e) => setCustomSshKeyName(e.target.value)}
                className="h-8 w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none"
                placeholder="e.g. keypair"
              />
              <span className="text-[10px] font-bold text-muted-foreground/60 select-none pr-1">
                .pem
              </span>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 pr-12 shadow-inner">
            <code className="block break-all text-[11.5px] font-mono text-slate-100 leading-normal select-all">
              {generatedSshCommand || "Target IP is not available yet. Refresh after the target server launches."}
            </code>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (generatedSshCommand) {
                handleCopyText(generatedSshCommand, true);
              }
            }}
            disabled={!generatedSshCommand}
            className="absolute right-2.5 top-2.5 h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-905 rounded-lg shrink-0 cursor-pointer"
            title="Copy command"
          >
            {copiedSsh ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {["draft", "preflight", "failed"].includes(activeJob.status) && (
          <div className="rounded-xl border border-slate-150 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Access Mode
                </Label>
                <Select value={accessMode} onValueChange={(val) => setAccessMode(val as AccessMode)}>
                  <SelectTrigger className="h-9 text-xs font-extrabold bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Access Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloud_only">Cloud-Only Mode</SelectItem>
                    <SelectItem value="deep_inspection">Deep Inspection Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleConfigureAccess}
                disabled={isConfiguringAccess}
                className="h-9 shrink-0 bg-[#2563eb] px-4 text-xs font-extrabold text-white hover:bg-blue-700 cursor-pointer"
              >
                {isConfiguringAccess ? "Saving..." : "Save Config"}
              </Button>
            </div>

            {accessMode === "deep_inspection" && (
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 dark:border-slate-800 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                    Method
                  </Label>
                  <Select
                    value={activeJob.provider === "azure" ? "ssh" : accessMethod}
                    onValueChange={(val) => setAccessMethod(val as AccessMethod)}
                  >
                    <SelectTrigger className="h-9 text-xs font-extrabold bg-white dark:bg-slate-955">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ssh">SSH Private Key</SelectItem>
                      {activeJob.provider === "aws" && (
                        <SelectItem value="ssm">AWS Systems Manager (SSM)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {accessMethod === "ssh" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                        SSH Username
                      </Label>
                      <Input
                        value={sshUsername}
                        onChange={(e) => setSshUsername(e.target.value)}
                        className="h-9 text-xs font-semibold bg-white dark:bg-slate-950"
                        placeholder="e.g. ubuntu"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                        SSH Port
                      </Label>
                      <Input
                        type="number"
                        value={sshPort}
                        onChange={(e) => setSshPort(Number(e.target.value))}
                        className="h-9 text-xs font-semibold bg-white dark:bg-slate-955"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                        Private Key (.pem)
                      </Label>
                      <Textarea
                        value={sshKey}
                        onChange={(e) => setSshKey(e.target.value)}
                        placeholder="Paste private key content..."
                        className="h-16 text-xs font-mono bg-white dark:bg-slate-950"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400 space-y-1.5 bg-slate-50/55 dark:bg-slate-900/10 p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <span className="font-extrabold text-[#64748b] block mb-1">
            Terminal Setup Instructions
          </span>
          <p>1. Open your local terminal or command prompt.</p>
          <p>
            2. Navigate (<code className="font-mono text-slate-800 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-800 px-1 rounded">cd</code>) to the folder where your key pair file is saved:
          </p>
          <pre className="text-[10px] font-mono bg-slate-100 dark:bg-slate-900 p-1.5 rounded mt-0.5 text-[#64748b]">
            cd /path/to/key-directory
          </pre>
          <p className="mt-1">3. Paste the copied SSH command and press Enter.</p>
          <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium mt-2 pt-1 border-t border-slate-200/50 dark:border-slate-800">
            Note for Linux/macOS users: Set secure permissions for the private key before running:
            <code className="block font-mono bg-amber-50 dark:bg-amber-955/20 px-1.5 py-0.5 rounded mt-1 font-bold text-amber-800 dark:text-amber-400">
              chmod 400 &quot;{activeJob.metadata?.targetAccessProfile?.keyPairName || activeJob.metadata?.sourceAccessProfile?.keyPairName || "keypair"}.pem&quot;
            </code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
