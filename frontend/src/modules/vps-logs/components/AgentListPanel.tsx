"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Server, Trash2, Check, Copy, Clipboard, Info, RefreshCw, Container } from "@/icons";
import { type Agent } from "../hooks/useVpsLogs";

interface AgentListPanelProps {
  agents: Agent[];
  selectedAgent: string;
  setSelectedAgent: (id: string) => void;
  selectedAgentLabel: string;
  selectedSourceLabel: string;
  selectedSource: string;
  setSelectedSource: (src: any) => void;
  newAgentName: string;
  setNewAgentName: (name: string) => void;
  newAgentVpcId: string;
  setNewAgentVpcId: (vpcId: string) => void;
  creatingAgent: boolean;
  createAgent: () => void;
  createdCredentials: { agentId: string; ingestKey: string; apiBaseUrl: string } | null;
  copiedId: string | null;
  handleCopy: (text: string, id: string) => void;
  editingAgent: Agent | null;
  setEditingAgent: (agent: Agent | null) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  handleUpdateAgentConfig: (agentId: string, updates: any) => void;
  agentToDelete: Agent | null;
  setAgentToDelete: (agent: Agent | null) => void;
  confirmDeleteAgent: () => void;
  sourceOptions: { value: string; label: string }[];
}

export function AgentListPanel({
  agents,
  selectedAgent,
  setSelectedAgent,
  selectedAgentLabel,
  selectedSourceLabel,
  selectedSource,
  setSelectedSource,
  newAgentName,
  setNewAgentName,
  newAgentVpcId,
  setNewAgentVpcId,
  creatingAgent,
  createAgent,
  createdCredentials,
  copiedId,
  handleCopy,
  editingAgent,
  setEditingAgent,
  isSettingsOpen,
  setIsSettingsOpen,
  handleUpdateAgentConfig,
  agentToDelete,
  setAgentToDelete,
  confirmDeleteAgent,
  sourceOptions,
}: AgentListPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="relative z-10 hover:z-20 focus-within:z-30 transition-all">
        <CardHeader>
          <CardTitle>Collector Agent Setup</CardTitle>
          <CardDescription>Install the robust Node.js agent on your VPS for logs and metrics collection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Input
              placeholder="Agent name (e.g. Production VPS)"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
            />
            <Input
              placeholder="VPC ID (optional)"
              value={newAgentVpcId}
              onChange={(e) => setNewAgentVpcId(e.target.value)}
            />
            <Button onClick={createAgent} disabled={creatingAgent || !newAgentName.trim()}>
              {creatingAgent ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Generate Agent Key
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Note: The agent's environment will be automatically determined by the server's running configuration.
          </p>

          {createdCredentials ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Shield className="h-5 w-5" />
                  <p className="font-bold">Agent Credentials Generated</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8]">Agent ID</p>
                    <code className="block bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-bold text-foreground dark:text-slate-100">
                      {createdCredentials.agentId}
                    </code>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8]">Ingest Key</p>
                    <code className="block bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-bold text-foreground dark:text-slate-100">
                      {createdCredentials.ingestKey}
                    </code>
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-xl p-5 bg-background space-y-4 shadow-sm">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Installation Guide</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-foreground dark:text-slate-100">1. Install the SDK package</p>
                    <div className="relative group">
                      <pre className="bg-slate-50 dark:bg-[#050C16] border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 rounded-lg p-3 text-xs overflow-auto pr-10">
                        npm install -g @rabbittwatch/vps-agent
                      </pre>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1.5 top-1.5 h-6 w-6 text-slate-400 hover:text-slate-100 hover:bg-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        onClick={() => handleCopy("npm install -g @rabbittwatch/vps-agent", "npmInstall")}
                        title="Copy command"
                      >
                        {copiedId === "npmInstall" ? <Check className="h-3 w-3 text-green-500 animate-in fade-in" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-bold text-foreground dark:text-slate-100">2. Create Systemd Service File</p>
                    <p className="text-xs text-muted-foreground mb-2">Create a systemd configuration file at the following path:</p>
                    <div className="relative group mb-3 flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-2.5 text-xs font-mono border border-border">
                      <code className="flex-1 truncate font-bold text-foreground">
                        /etc/systemd/system/rabbitt-agent.service
                      </code>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        onClick={() => handleCopy("/etc/systemd/system/rabbitt-agent.service", "filePath")}
                        title="Copy path"
                      >
                        {copiedId === "filePath" ? <Check className="h-3.5 w-3.5 text-green-500 animate-in fade-in" /> : <Clipboard className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="relative group">
                      <pre className="bg-slate-50 dark:bg-[#050C16] border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 rounded-lg p-3 text-xs overflow-auto pr-10">
{`[Unit]
Description=RabbittWatch VPS Agent
After=network.target

[Service]
Type=simple
User=root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=AGENT_ID=${createdCredentials.agentId}
Environment=INGEST_KEY=${createdCredentials.ingestKey}
Environment=API_BASE_URL=${createdCredentials.apiBaseUrl}
Environment=ENABLED_SOURCES=system,docker,pm2,nginx,apache
ExecStart=/usr/bin/node /usr/lib/node_modules/@rabbittwatch/vps-agent/dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target`}
                      </pre>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1.5 top-1.5 h-6 w-6 text-slate-400 hover:text-slate-100 hover:bg-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        onClick={() => {
                          const serviceContent = `[Unit]\nDescription=RabbittWatch VPS Agent\nAfter=network.target\n\n[Service]\nType=simple\nUser=root\nEnvironment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nEnvironment=AGENT_ID=${createdCredentials.agentId}\nEnvironment=INGEST_KEY=${createdCredentials.ingestKey}\nEnvironment=API_BASE_URL=${createdCredentials.apiBaseUrl}\nEnvironment=ENABLED_SOURCES=system,docker,pm2,nginx,apache\nExecStart=/usr/bin/node /usr/lib/node_modules/@rabbittwatch/vps-agent/dist/index.js\nRestart=on-failure\nRestartSec=10\n\n[Install]\nWantedBy=multi-user.target`;
                          handleCopy(serviceContent, "serviceContent");
                        }}
                        title="Copy service file contents"
                      >
                        {copiedId === "serviceContent" ? <Check className="h-3 w-3 text-green-500 animate-in fade-in" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-800 dark:text-amber-300 leading-normal space-y-2">
                      <p className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <Info className="h-4 w-4 text-amber-500 shrink-0" /> Node/NPM Global Path Hint (local/ prefix):
                      </p>
                      <p>
                        Depending on your Node.js installation (e.g., standard apt vs. manual/nvm), your system might place global packages in <code>/usr/local/</code>. If your service fails to start or says "no such file", check your paths by running:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                        <div className="bg-slate-950 text-slate-100 p-2 rounded text-[11px] font-mono relative group">
                          <span>which node</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1 h-5 w-5 text-slate-400 hover:text-slate-100"
                            onClick={() => handleCopy("which node", "whichNode")}
                          >
                            {copiedId === "whichNode" ? <Check className="h-3 w-3 text-green-400 animate-in fade-in" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                        <div className="bg-slate-950 text-slate-100 p-2 rounded text-[11px] font-mono relative group">
                          <span>readlink -f $(which rabbitt-agent)</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1 h-5 w-5 text-slate-400 hover:text-slate-100"
                            onClick={() => handleCopy("readlink -f $(which rabbitt-agent)", "readlink")}
                          >
                            {copiedId === "readlink" ? <Check className="h-3 w-3 text-green-400 animate-in fade-in" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="relative z-10 hover:z-20 focus-within:z-30 transition-all">
        <CardHeader>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Active Agents & Logs</CardTitle>
              <CardDescription>Select an agent to restrict logs and performance summaries below.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Agent List</p>
              <Button
                variant={selectedAgent === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedAgent("all")}
              >
                View All Logs
              </Button>
            </div>

            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agents created yet.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {agents.map((agent) => {
                  const isSelected = selectedAgent === agent.agentId;
                  return (
                    <div
                      key={agent.agentId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedAgent(agent.agentId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedAgent(agent.agentId);
                        }
                      }}
                      className={`text-left border rounded-lg p-3 transition-colors cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{agent.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={isSelected ? "default" : "outline"}>
                            {agent.environment || "n/a"}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingAgent(agent);
                              setIsSettingsOpen(true);
                            }}
                          >
                            Settings
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAgentToDelete(agent);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {agent.vpcId ? `VPC: ${agent.vpcId}` : "VPC not specified"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Last seen: {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : "Never"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
          <DialogHeader className="bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_100%)] dark:bg-[linear-gradient(135deg,#0F172A_0%,#1E293B_100%)] border-b border-slate-100 dark:border-slate-800 p-5 space-y-0 text-left">
            <DialogTitle className="flex items-center gap-2 mb-1">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <Server className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-extrabold text-foreground dark:text-slate-100">Agent Settings: {editingAgent?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground leading-relaxed">
              Configure collection intervals, source streams, and copy commands to sync files.
            </DialogDescription>
          </DialogHeader>

          {editingAgent && (
            <div className="p-5 bg-white dark:bg-[#07111F] space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8]">Collection Interval (seconds)</Label>
                <Input
                  type="number"
                  min="60"
                  step="60"
                  className="h-10 border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-foreground dark:text-slate-100"
                  defaultValue={editingAgent.collectionInterval || 300}
                  onChange={(e) => setEditingAgent({ ...editingAgent, collectionInterval: parseInt(e.target.value, 10) })}
                />
                <p className="text-[10px] text-muted-foreground">How often the agent should poll and send logs.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8]">Enabled Sources</Label>
                <div className="grid grid-cols-2 gap-3">
                  {["docker", "pm2", "system", "nginx", "apache"].map((source) => (
                    <div key={source} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors">
                      <input
                        type="checkbox"
                        id={`source-${source}`}
                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                        checked={editingAgent.enabledSources?.includes(source) || false}
                        onChange={(e) => {
                          const current = editingAgent.enabledSources || [];
                          const next = e.target.checked
                            ? [...current, source]
                            : current.filter((s) => s !== source);
                          setEditingAgent({ ...editingAgent, enabledSources: next });
                        }}
                      />
                      <label htmlFor={`source-${source}`} className="text-xs font-semibold text-foreground dark:text-slate-200 capitalize cursor-pointer select-none">{source}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-primary/10 rounded-xl bg-primary/5 p-4 space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Apply Settings Step-by-Step</p>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  The agent automatically checks for settings updates every 10 minutes. To apply immediately, update the <code>Environment</code> lines in your service file and restart the service:
                </p>
                <div className="relative group">
                  <pre className="bg-slate-50 dark:bg-[#050C16] border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 rounded-lg p-2.5 text-[10px] overflow-auto pr-8">
{`Environment=COLLECTION_INTERVAL=${editingAgent.collectionInterval || 300}
Environment=ENABLED_SOURCES=${(editingAgent.enabledSources || []).join(',')}`}
                  </pre>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 h-5.5 w-5.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    onClick={() => {
                      const envSnippet = `Environment=COLLECTION_INTERVAL=${editingAgent.collectionInterval || 300}\nEnvironment=ENABLED_SOURCES=${(editingAgent.enabledSources || []).join(',')}`;
                      handleCopy(envSnippet, "modalEnv");
                    }}
                    title="Copy environment lines"
                  >
                    {copiedId === "modalEnv" ? <Check className="h-2.5 w-2.5 text-green-500 animate-in fade-in" /> : <Copy className="h-2.5 w-2.5" />}
                  </Button>
                </div>
                <div className="relative group">
                  <pre className="bg-slate-50 dark:bg-[#050C16] border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 rounded-lg p-2.5 text-[10px] overflow-auto pr-8">
{`sudo systemctl daemon-reload
sudo systemctl restart rabbitt-agent`}
                  </pre>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 h-5.5 w-5.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    onClick={() => {
                      handleCopy("sudo systemctl daemon-reload\nsudo systemctl restart rabbitt-agent", "modalRestart");
                    }}
                    title="Copy restart commands"
                  >
                    {copiedId === "modalRestart" ? <Check className="h-2.5 w-2.5 text-green-500 animate-in fade-in" /> : <Copy className="h-2.5 w-2.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <Button variant="outline" className="h-10 text-xs font-semibold rounded-xl" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button className="h-10 text-xs font-semibold bg-primary text-white rounded-xl" onClick={() => handleUpdateAgentConfig(editingAgent.agentId, {
                  collectionInterval: editingAgent.collectionInterval,
                  enabledSources: editingAgent.enabledSources
                })}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Agent Confirmation */}
      <Dialog open={!!agentToDelete} onOpenChange={(open) => !open && setAgentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the agent "{agentToDelete?.name}"? This action cannot be undone and will remove all ingested logs.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setAgentToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteAgent}>Delete Agent</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
