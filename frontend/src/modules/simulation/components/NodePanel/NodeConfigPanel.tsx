"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Save, Network, ExternalLink, Copy, Check, Github } from "@/icons";
import { z } from "zod";
import { startOAuthFlow } from "@/lib/oauth";
import { authFetchJson } from "@/lib/auth-fetch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ServiceNodeData } from "../Canvas/nodes";
import { findService, SERVICE_COLORS } from "../../registry";
import { parseZodFields, validateAllFields } from "@/lib/zod-form-fields";
import { FormField } from "./SharedConfig";
import { AwsConfig } from "./NodeConfigPanel/AwsConfig";
import { AzureConfig } from "./NodeConfigPanel/AzureConfig";
import { GcpConfig } from "./NodeConfigPanel/GcpConfig";

interface NodeConfigPanelProps {
  nodeData: ServiceNodeData;
  nodeId?: string;
  onSave: (updates: Partial<ServiceNodeData>) => void;
  onClose: () => void;
  outputs?: Record<string, any>;
}

export function NodeConfigPanel({ nodeData, nodeId, onSave, onClose, outputs }: NodeConfigPanelProps) {
  const service = useMemo(() => findService(nodeData.serviceId), [nodeData.serviceId]);
  const fields = useMemo(() => (service?.schema ? parseZodFields(service.schema, service.provider) : []), [service?.schema, service?.provider]);

  function buildInit(config: Record<string, unknown>) {
    const init: Record<string, any> = {};
    for (const f of fields) init[f.key] = config[f.key] ?? f.defaultValue;
    return init;
  }

  const [values, setValues] = useState<Record<string, any>>(() => buildInit(nodeData.config));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sshUsername, setSshUsername] = useState("");
  const [sshKeyName, setSshKeyName] = useState("");

  useEffect(() => { setValues(buildInit(nodeData.config)); }, [nodeData.config]);

  const visibleFields = useMemo(() => {
    let filtered = fields;
    if (nodeData.serviceId === "github") {
      filtered = fields.filter((f) => f.key !== "gitUrl" && f.key !== "gitBranch" && f.key !== "gitToken");
    } else if (["ec2", "azure_vm", "gcp_compute", "asg", "azure_vmss", "gcp_mig"].includes(nodeData.serviceId)) {
      filtered = fields.filter((f) => !["gitUrl", "gitBranch", "gitToken", "appRuntime", "buildCommand", "startCommand", "appPort"].includes(f.key));
    } else if (["ecr", "azure_acr", "gcp_artifact_registry"].includes(nodeData.serviceId)) {
      filtered = values.repositoryMode === "existing"
        ? fields.filter((f) => !["repositoryName", "imageMutability", "scanOnPush", "registryName", "sku", "adminEnabled", "repositoryId", "format", "description"].includes(f.key))
        : fields.filter((f) => !["existingRepositoryUrl", "imageTag"].includes(f.key));
    } else if (nodeData.serviceId === "ecs") {
      filtered = fields.filter((f) => {
        if (f.key === "useFargateSpot" && values.launchType !== "FARGATE") return false;
        if (f.key === "fargateSpotWeight" && (values.launchType !== "FARGATE" || !values.useFargateSpot)) return false;
        if (f.key === "serviceConnectName" && !values.enableServiceConnect) return false;
        if (["minCapacity", "maxCapacity", "cpuTarget"].includes(f.key) && !values.enableAutoscaling) return false;
        if (f.key === "sidecarType" && !values.enableSidecar) return false;
        return true;
      });
    } else if (nodeData.serviceId === "cloudfront") {
      filtered = fields.filter((f) => {
        if (f.key === "allowPrivateBucketAccess" && values.originType !== "S3") return false;
        if (f.key === "originProtocolPolicy" && ["S3", "VPCOrigin"].includes(values.originType)) return false;
        return true;
      });
    }
    return filtered;
  }, [fields, nodeData.serviceId, values.repositoryMode, values.launchType, values.useFargateSpot, values.enableServiceConnect, values.enableAutoscaling, values.enableSidecar, values.originType]);

  const vmInfoKey = useMemo(() => `vm_info_sim_${nodeId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_")}`, [nodeId]);
  const vmInfo = useMemo(() => outputs?.[vmInfoKey]?.value || outputs?.[vmInfoKey], [outputs, vmInfoKey]);
  const lbInfoKey = useMemo(() => `lb_info_sim_${nodeId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_")}`, [nodeId]);
  const lbInfo = useMemo(() => outputs?.[lbInfoKey]?.value || outputs?.[lbInfoKey], [outputs, lbInfoKey]);
  const [lbCopied, setLbCopied] = useState(false);

  useEffect(() => {
    if (vmInfo) {
      setSshUsername(vmInfo.username || "admin");
      setSshKeyName(vmInfo.key_name || "key");
    }
  }, [vmInfo]);

  const updateValue = useCallback((key: string, value: any) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (nodeData.serviceId === "cloudfront" && key === "originType") {
        const mappings: Record<string, string> = {
          S3: "sim-s3-bucket.s3.amazonaws.com", ELB: "sim-elb.us-east-1.elb.amazonaws.com",
          APIGateway: "abcde12345.execute-api.us-east-1.amazonaws.com", MediaPackage: "mediapackage.us-east-1.amazonaws.com",
          VPCOrigin: "vpce-0123456789abcdef0.vpce.us-east-1.vpce.amazonaws.com"
        };
        next.originDomainName = mappings[value] || "custom-origin.example.com";
      }
      return next;
    });
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }, [nodeData.serviceId]);

  // GitHub States & Effects
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");

  useEffect(() => {
    if (nodeData.serviceId !== "github") return;
    let active = true;
    async function loadGithub() {
      setGithubLoading(true);
      try {
        const res = await authFetchJson("/api/github/status", z.object({ success: z.boolean(), connected: z.boolean() }));
        if (!active) return;
        setGithubConnected(res.connected);
        if (res.connected) {
          setFetchingRepos(true);
          const rRes = await authFetchJson("/api/github/repos", z.object({ success: z.boolean(), repos: z.array(z.any()) }));
          if (active) setRepos(rRes.repos || []);
        }
      } catch (e) { console.error(e); } finally { if (active) { setGithubLoading(false); setFetchingRepos(false); } }
    }
    loadGithub();
    return () => { active = false; };
  }, [nodeData.serviceId]);

  const selectedRepo = useMemo(() => values.gitUrl && repos.length ? repos.find(r => r.cloneUrl === values.gitUrl) || null : null, [values.gitUrl, repos]);

  useEffect(() => {
    if (!selectedRepo) return;
    let active = true;
    async function loadBranches() {
      setFetchingBranches(true);
      try {
        const res = await authFetchJson(`/api/github/branches?repo=${encodeURIComponent(selectedRepo.fullName)}`, z.object({ success: z.boolean(), branches: z.array(z.any()) }));
        if (active) setBranches(res.branches || []);
      } catch (e) { console.error(e); } finally { if (active) setFetchingBranches(false); }
    }
    loadBranches();
    return () => { active = false; };
  }, [selectedRepo]);

  const handleSave = useCallback(() => {
    const errs = validateAllFields(fields, values);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const newConfig: Record<string, unknown> = {};
    for (const f of fields) newConfig[f.key] = f.type === "number" ? Number(values[f.key]) : values[f.key];
    setSaving(true);
    setTimeout(() => { onSave({ ...nodeData, config: newConfig }); setSaving(false); onClose(); }, 150);
  }, [fields, values, nodeData, onSave, onClose]);

  const configProps = {
    nodeData, nodeId, values, errors, updateValue, visibleFields, vmInfo, copied,
    handleCopySsh: (cmd: string) => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 2000); },
    sshUsername, setSshUsername, sshKeyName, setSshKeyName
  };

  const accentColor = SERVICE_COLORS[nodeData.serviceId]?.accent || "#64748b";

  return (
    <>
      <div className="fixed inset-0 z-[150]" onClick={onClose} />
      <AnimatePresence>
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="simulation-card fixed right-0 top-0 z-[160] h-screen w-[min(420px,92vw)] rounded-none border-y-0 border-r-0"
        >
          <div className="flex items-center gap-4 border-b border-border px-6 py-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm" style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}>
              <span className="text-xs font-extrabold">{nodeData.serviceId.toUpperCase().slice(0, 4)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-extrabold text-foreground">{nodeData.label}</h2>
              <p className="truncate text-[11px] font-semibold text-muted-foreground">{nodeId ?? nodeData.serviceId}</p>
            </div>
            <button onClick={onClose} className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <ScrollArea className="h-[calc(100%-140px)] px-6 py-5 animate-none">
            <div className="space-y-5">
              {lbInfo?.url && (
                <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 text-left space-y-3">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-teal-500" />
                    <span className="text-xs font-bold text-foreground">Load Balancer Endpoints</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    The load balancer is active and routing requests. Click below to view the application.
                  </p>
                  <div className="relative mt-2 flex items-center justify-between rounded-lg bg-black/40 border border-border/50 px-3.5 py-2 font-mono text-[10px] text-foreground select-all break-all pr-20">
                    <a href={lbInfo.url} target="_blank" rel="noreferrer" className="text-teal-500 dark:text-teal-400 hover:underline flex items-center gap-1 font-semibold truncate">
                      {lbInfo.url} <ExternalLink className="h-3 w-3 inline" />
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(lbInfo.url); setLbCopied(true); setTimeout(() => setLbCopied(false), 2000); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                      {lbCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {nodeData.serviceId === "github" && (
                <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/20 p-5 select-text">
                  <div className="flex items-center justify-between border-b border-border/50 pb-4">
                    <div className="flex items-center gap-2.5">
                      <Github className="h-5 w-5 text-foreground" />
                      <span className="text-sm font-extrabold text-foreground">GitHub Account</span>
                    </div>
                    {githubConnected && (
                      <button type="button" onClick={() => setShowDisconnectModal(true)} className="text-[11px] font-bold text-red-500 hover:text-red-600 transition">
                        Disconnect
                      </button>
                    )}
                  </div>
                  {githubLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-transparent border-t-foreground" />
                    </div>
                  ) : githubConnected === false ? (
                    <div className="text-center py-4 space-y-4">
                      <p className="text-xs text-muted-foreground leading-relaxed">Connect your GitHub account to directly browse repositories and branches.</p>
                      <Button onClick={() => { sessionStorage.setItem("connect_github", "true"); sessionStorage.setItem("github_redirect_back", window.location.pathname); startOAuthFlow("github"); }} className="w-full bg-[#24292e] text-white hover:bg-[#2c3238] font-bold">
                        <Github className="mr-2 h-4 w-4 fill-current" /> Connect GitHub Account
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground">Repository</Label>
                        {fetchingRepos ? (
                          <div className="h-10 rounded-lg border border-border bg-background flex items-center justify-center"><span className="text-xs text-muted-foreground animate-pulse">Loading...</span></div>
                        ) : (
                          <div className="space-y-2">
                            {repos.length > 8 && <input type="text" placeholder="Filter..." value={repoSearch} onChange={(e) => setRepoSearch(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-foreground" />}
                            <Select value={selectedRepo?.fullName || ""} onValueChange={(val) => { const r = repos.find(x => x.fullName === val); if (r) { updateValue("gitUrl", r.cloneUrl); updateValue("gitBranch", r.defaultBranch || "master"); } }}>
                              <SelectTrigger className="h-10 w-full rounded-lg border-border bg-background font-semibold text-foreground"><SelectValue placeholder="Select a repository" /></SelectTrigger>
                              <SelectContent position="popper" align="start" className="z-[300] w-[var(--radix-select-trigger-width)] rounded-xl border-[#E2E8F0] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.14)] dark:border-[#334155] dark:bg-[#0B1728] max-h-60">
                                {repos.filter((r) => r.fullName.toLowerCase().includes(repoSearch.toLowerCase())).map((r) => <SelectItem key={r.fullName} value={r.fullName}>{r.fullName}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {selectedRepo && (
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Branch</Label>
                          {fetchingBranches ? (
                            <div className="h-10 rounded-lg border border-border bg-background flex items-center justify-center"><span className="text-xs text-muted-foreground animate-pulse">Loading...</span></div>
                          ) : (
                            <Select value={String(values.gitBranch || "")} onValueChange={(val) => updateValue("gitBranch", val)}>
                              <SelectTrigger className="h-10 w-full rounded-lg border-border bg-background font-semibold text-foreground"><SelectValue placeholder="Select a branch" /></SelectTrigger>
                              <SelectContent position="popper" align="start" className="z-[300] w-[var(--radix-select-trigger-width)] rounded-xl border-[#E2E8F0] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.14)] dark:border-[#334155] dark:bg-[#0B1728] max-h-60">
                                {branches.map((b) => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {service?.provider === "aws" && <AwsConfig {...configProps} />}
              {service?.provider === "azure" && <AzureConfig {...configProps} />}
              {service?.provider === "gcp" && <GcpConfig {...configProps} />}
              {!service?.provider && nodeData.serviceId !== "github" && visibleFields.map((field) => (
                <FormField key={field.key} field={field} value={values[field.key] ?? field.defaultValue} error={errors[field.key] ?? null} onChange={(val) => updateValue(field.key, val)} />
              ))}
            </div>
          </ScrollArea>

          <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
            <button type="button" onClick={() => { setValues(buildInit(service?.defaultConfig ?? {})); setErrors({}); }} className="simulation-action min-h-9 px-3 py-2 text-muted-foreground">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            <button type="button" onClick={handleSave} disabled={Object.keys(errors).length > 0 || saving} className="simulation-action simulation-action-primary min-h-9 px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Config"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showDisconnectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDisconnectModal(false)} className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 15, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 15, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 350 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500"><Github className="h-6 w-6" /></div>
                <h3 className="text-base font-extrabold text-foreground">Disconnect GitHub?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">This will remove repository integration. You will need to reconnect.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowDisconnectModal(false)} className="flex-1 font-bold h-10 rounded-xl">Cancel</Button>
                <Button onClick={async () => { setShowDisconnectModal(false); try { await authFetchJson("/api/github/disconnect", z.object({ success: z.boolean() }), { method: "DELETE" }); setGithubConnected(false); setRepos([]); setBranches([]); updateValue("gitUrl", ""); updateValue("gitBranch", ""); } catch (err) { console.error(err); } }} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-10 rounded-xl">Disconnect</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
