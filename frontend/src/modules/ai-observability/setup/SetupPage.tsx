"use client";

import { KeyRound, Loader2, Plus, Trash2, Sparkles, ExternalLink, FileText, ShieldCheck } from "@/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConnectAppPanel } from "./components/ConnectAppPanel";
import { SetupCodeBlock } from "./components/SetupCodeBlock";
import { useIngestKeys } from "./hooks/useIngestKeys";

function getIngestEndpoint(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");
  }
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV;
  if (appEnv === "production") {
    return "https://rabbitize-api.rabbitt.ai";
  }
  if (appEnv === "staging") {
    return "http://stagingrabbitt.duckdns.org";
  }
  return "http://localhost:4000";
}

export function SetupPage() {
  const {
    keys,
    name,
    setName,
    createdKey,
    loading,
    creating,
    createKey,
    revokeKey,
  } = useIngestKeys();

  const quickstartKey = createdKey?.token || "rw_live_xxxxx";
  const quickstartEndpoint = getIngestEndpoint();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="border-b border-slate-100 pb-5 dark:border-slate-800">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50/50 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/30">
            <KeyRound className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Observability Setup
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
              Generate Ingest Keys to authenticate SDK telemetry from your services. 
              Configure your application with our step-by-step Quickstart guide below.
            </p>
          </div>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        
        {/* Left Column (Main: Quickstart Guide & Ingest Keys List) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Quickstart Panel */}
          <ConnectAppPanel
            ingestKey={quickstartKey}
            endpoint={quickstartEndpoint}
            service="support-api"
            environment="prod"
          />

          {/* Ingest Keys List */}
          <Card className="rounded-xl border border-slate-200/80 shadow-md dark:border-slate-800/80 overflow-hidden bg-card transition-all hover:shadow-lg">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <CardTitle className="text-lg font-bold">Ingest Keys</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Active and revoked keys used for authenticating telemetry. Revoke keys that are no longer in use.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex h-36 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : keys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <KeyRound className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No ingest keys yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                    Create an ingest key in the sidebar panel to start collecting telemetry data.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:border-slate-850 dark:bg-slate-900/20">
                        <th className="py-3 px-6">Name</th>
                        <th className="py-3 px-6">Prefix</th>
                        <th className="py-3 px-6">Last Used</th>
                        <th className="py-3 px-6">Status</th>
                        <th className="py-3 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {keys.map((key) => (
                        <tr key={key.id} className="transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                          <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-200">{key.name}</td>
                          <td className="py-4 px-6">
                            <span className="inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                              {key.prefix}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-muted-foreground">
                            {key.lastUsedAt
                              ? new Date(key.lastUsedAt).toLocaleString()
                              : "Never"}
                          </td>
                          <td className="py-4 px-6">
                            <Badge
                              variant="outline"
                              className={
                                key.revokedAt
                                  ? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
                              }
                            >
                              {key.revokedAt ? "Revoked" : "Active"}
                            </Badge>
                          </td>
                          <td className="py-4 px-6 text-right">
                            {!key.revokedAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => revokeKey(key.id)}
                                className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revoke
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          
        </div>

        {/* Right Column (Sidebar: Key Generation & Resources) */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Key Generation Panel */}
          <Card className="rounded-xl border border-slate-200/80 shadow-md dark:border-slate-800/80 overflow-hidden bg-card transition-all hover:shadow-lg">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-bold">Create Ingest Key</CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Generate a unique key to authenticate telemetry packets sent from your environment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  Ingest Key Name
                </label>
                <div className="relative">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g., staging support-api"
                    className="h-10 pr-4 pl-3 rounded-lg focus-visible:ring-1 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
              <Button
                onClick={createKey}
                disabled={creating || !name.trim()}
                className="w-full h-10 font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none cursor-pointer disabled:opacity-50 transition-colors"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Generate Ingest Key
              </Button>

              {/* Show Key Success Box */}
              {createdKey?.token && (
                <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-50/5 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-500">
                        Key created successfully!
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        Copy the token below immediately. For security, it will not be shown again.
                      </p>
                    </div>
                  </div>
                  <SetupCodeBlock value={createdKey.token} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Docs & Resources Panel */}
          <Card className="rounded-xl border border-slate-200/80 shadow-md dark:border-slate-800/80 overflow-hidden bg-card transition-all hover:shadow-lg">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-indigo-500" />
                Reference & Docs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="space-y-3.5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-900 transition-colors border border-slate-100/50 dark:border-slate-800/50">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Ingest Key Scopes</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Generated keys are scoped exclusively to `events:write` and `traces:write` actions.
                    </p>
                  </div>
                </div>

                <a
                  href="https://docs.rabbitt.ai/ai-observability/quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/30 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/20 text-xs font-medium text-indigo-600 dark:text-indigo-400 group transition-all"
                >
                  <span>Read full integration docs</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
