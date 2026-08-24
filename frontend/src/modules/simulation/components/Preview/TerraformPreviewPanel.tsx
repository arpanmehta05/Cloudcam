"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code, X, Rocket, AlertCircle, Server, HardDrive, Database, Zap, Cloud, Shield, Lock, Network } from "@/icons";
import { authFetch } from "@/lib/auth-fetch";
import { logSimulationAction } from "@/lib/simulation-action-log";
import { findService } from "../../registry";
import { hclPlaygroundApi } from "../../api/hcl-playground.api";
import { ResourceDetailsList } from "./ResourceDetailsList";
import { validateAllNodes } from "./validation";
import { CostEstimator } from "./TerraformPreview/CostEstimator";
import { CodeViewer } from "./TerraformPreview/CodeViewer";
import { getBaseId, normalizeConfig, parseTfJsonToGraph } from "./TerraformPreview/TfParserUtils";

interface TfResult {
  terraformJson: any;
  terraformHcl: string;
  resources: Array<{ address: string; type: string; name: string; serviceId: string }>;
  implicitResources: Array<{ address: string; type: string; name: string; serviceId: string }>;
  resourceCount: number;
}

interface TerraformPreviewPanelProps {
  nodes: any[];
  setNodes: (nodes: any[]) => void;
  edges: any[];
  setEdges: (edges: any[]) => void;
  region: string;
  provider: "aws" | "azure" | "gcp";
  onClose: () => void;
  onDeploy?: () => void;
}

const RESOURCE_ICONS = { ec2: Server, s3: HardDrive, rds: Database, lambda: Zap, vpc: Cloud, subnet: Network, sg: Shield, iam: Lock, igw: Cloud, gcp_compute: Server, gcp_storage: HardDrive, gcp_sql: Database, gcp_function: Zap, gcp_gke: Server };
const RESOURCE_TYPE_LABELS = { aws_instance: "EC2 Instance", aws_s3_bucket: "S3 Bucket", aws_db_instance: "RDS Database", aws_lambda_function: "Lambda Function", aws_vpc: "VPC", aws_subnet: "Subnet", aws_internet_gateway: "Internet Gateway", aws_security_group: "Security Group", aws_db_subnet_group: "DB Subnet Group", aws_iam_role: "IAM Role", aws_iam_role_policy_attachment: "IAM Policy", azurerm_linux_virtual_machine: "Azure Virtual Machine", azurerm_storage_account: "Azure Storage Account", azurerm_mssql_database: "Azure SQL Database", azurerm_linux_function_app: "Azure Function App", azurerm_virtual_network: "Azure Virtual Network", google_compute_instance: "Compute Engine VM", google_storage_bucket: "Cloud Storage Bucket", google_sql_database_instance: "Cloud SQL Instance", google_sql_database: "Cloud SQL Database", google_cloudfunctions2_function: "Cloud Run Function", google_container_cluster: "GKE Cluster", google_container_node_pool: "GKE Node Pool", google_compute_network: "VPC Network", google_compute_subnetwork: "VPC Subnet", google_compute_firewall: "Firewall" };
const serviceColors = { ec2: "text-blue-500", s3: "text-emerald-500", rds: "text-amber-500", lambda: "text-violet-500", gcp_compute: "text-blue-500", gcp_storage: "text-emerald-500", gcp_sql: "text-amber-500", gcp_function: "text-sky-500", gcp_gke: "text-indigo-500" };

export function TerraformPreviewPanel({ nodes, setNodes, edges, setEdges, region, provider, onClose, onDeploy }: TerraformPreviewPanelProps) {
  const [result, setResult] = useState<TfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [format, setFormat] = useState<"json" | "hcl">("hcl");
  const [localHcl, setLocalHcl] = useState("");
  const [localJson, setLocalJson] = useState("{}");

  const lastParsedHclRef = useRef("");
  const lastParsedJsonRef = useRef("");
  const isEditorFocusedRef = useRef(false);
  const lastUpdateSourceRef = useRef<"editor" | "canvas">("canvas");

  const validationErrors = useMemo(() => validateAllNodes(nodes.filter(n => n.data?.serviceId).map(n => ({ id: n.id, serviceId: n.data?.serviceId, config: n.data?.config, label: n.data?.label }))), [nodes]);

  const fetchTerraform = useCallback(async () => {
    if (nodes.length === 0) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await authFetch("/api/simulation/terraform", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: nodes.filter(n => n.data?.serviceId).map(n => ({ id: n.id, serviceId: n.data?.serviceId, config: n.data?.config, label: n.data?.label })), edges, region, provider }),
      });
      const data = await res.json();
      setResult(data);
      if (lastUpdateSourceRef.current !== "editor") {
        if (data.terraformHcl) setLocalHcl(data.terraformHcl);
        if (data.terraformJson) setLocalJson(JSON.stringify(data.terraformJson, null, 2));
      }
    } catch (err: any) { setApiError(err?.message || "Failed to generate Terraform."); } finally { setLoading(false); }
  }, [nodes, edges, region, provider]);

  useEffect(() => { fetchTerraform(); }, [fetchTerraform]);
  useEffect(() => { if (!isEditorFocusedRef.current) lastUpdateSourceRef.current = "canvas"; }, [nodes, edges]);

  useEffect(() => {
    if (isEditorFocusedRef.current || lastUpdateSourceRef.current === "editor") return;
    if (result?.terraformHcl && result.terraformHcl !== localHcl && result.terraformHcl !== lastParsedHclRef.current) setLocalHcl(result.terraformHcl);
    if (result?.terraformJson) {
      const jsonStr = JSON.stringify(result.terraformJson, null, 2);
      if (jsonStr !== localJson && jsonStr !== lastParsedJsonRef.current) setLocalJson(jsonStr);
    }
  }, [result, localHcl, localJson]);

  const handleLocalHclParse = useCallback(async (code: string) => {
    try {
      setLoading(true);
      const res = await hclPlaygroundApi.parseHcl(code);
      lastParsedHclRef.current = code;
      const matchedNodeIds = new Set<string>();
      const mappedNodes = res.nodes.map((node: any) => {
        const def = findService(node.serviceId);
        const existingNode = nodes.find(n => n.data?.serviceId === node.serviceId && !matchedNodeIds.has(n.id));
        if (existingNode) matchedNodeIds.add(existingNode.id);
        const finalId = existingNode ? existingNode.id : node.id;
        const normalized = normalizeConfig(node.serviceId, node.config || {});
        return { id: finalId, type: "service", data: { serviceId: node.serviceId, label: normalized.name || finalId, description: def?.description || "", icon: def?.icon || "Server", colorKey: def?.colorKey || node.serviceId, config: { ...(def?.defaultConfig || {}), ...normalized } }, position: existingNode?.position || node.position || { x: 50, y: 50 }, _parserId: node.id };
      });
      const mappedEdges = res.edges.map((edge: any, idx: number) => {
        const sourceNode = mappedNodes.find((n: any) => n._parserId === edge.source);
        const targetNode = mappedNodes.find((n: any) => n._parserId === edge.target);
        return { id: `e-${sourceNode?.id || edge.source}-${targetNode?.id || edge.target}-${idx}`, source: sourceNode?.id || edge.source, target: targetNode?.id || edge.target, sourceHandle: `${sourceNode?.data?.serviceId || "unknown"}-out`, targetHandle: `${targetNode?.data?.serviceId || "unknown"}-in`, animated: true, style: { stroke: "var(--primary)", strokeWidth: 2 } };
      });
      lastUpdateSourceRef.current = "editor";
      setNodes([...mappedNodes, ...nodes.filter(n => n.type === "annotation")]);
      setEdges(mappedEdges);
      setApiError(null);
    } catch (err: any) { setApiError(err?.message || "HCL parse failed."); } finally { setLoading(false); }
  }, [nodes, setNodes, setEdges]);

  useEffect(() => {
    if (format !== "hcl") return;
    const timer = setTimeout(() => {
      if (localHcl && localHcl !== result?.terraformHcl && localHcl !== lastParsedHclRef.current) handleLocalHclParse(localHcl);
    }, 800);
    return () => clearTimeout(timer);
  }, [localHcl, result, handleLocalHclParse, format]);

  const handleLocalJsonParse = useCallback((code: string) => {
    try {
      const parsed = JSON.parse(code);
      lastParsedJsonRef.current = code;
      const { nodes: parsedNodes, edges: parsedEdges } = parseTfJsonToGraph(parsed, nodes);
      const matchedNodeIds = new Set<string>();
      const mappedNodes = parsedNodes.map((node: any) => {
        const def = findService(node.serviceId);
        const existingNode = nodes.find(n => n.data?.serviceId === node.serviceId && !matchedNodeIds.has(n.id));
        if (existingNode) matchedNodeIds.add(existingNode.id);
        return { id: existingNode ? existingNode.id : node.id, type: "service", data: { serviceId: node.serviceId, label: node.config?.name || node.id, description: def?.description || "", icon: def?.icon || "Server", colorKey: def?.colorKey || node.serviceId, config: { ...(def?.defaultConfig || {}), ...(node.config || {}) } }, position: existingNode?.position || { x: 50, y: 50 }, _parserId: node.id };
      });
      const mappedEdges = parsedEdges.map((edge: any, idx: number) => {
        const sourceNode = mappedNodes.find((n: any) => n._parserId === edge.source);
        const targetNode = mappedNodes.find((n: any) => n._parserId === edge.target);
        return { id: `e-${sourceNode?.id || edge.source}-${targetNode?.id || edge.target}-${idx}`, source: sourceNode?.id || edge.source, target: targetNode?.id || edge.target, sourceHandle: `${sourceNode?.data?.serviceId || "unknown"}-out`, targetHandle: `${targetNode?.data?.serviceId || "unknown"}-in`, animated: true, style: { stroke: "var(--primary)", strokeWidth: 2 } };
      });
      lastUpdateSourceRef.current = "editor";
      setNodes([...mappedNodes, ...nodes.filter(n => n.type === "annotation")]);
      setEdges(mappedEdges);
      setApiError(null);
    } catch (err: any) { setApiError("Invalid JSON structure."); }
  }, [nodes, setNodes, setEdges]);

  useEffect(() => {
    if (format !== "json") return;
    const timer = setTimeout(() => {
      const jsonStr = result?.terraformJson ? JSON.stringify(result.terraformJson, null, 2) : "{}";
      if (localJson && localJson !== jsonStr && localJson !== lastParsedJsonRef.current) handleLocalJsonParse(localJson);
    }, 800);
    return () => clearTimeout(timer);
  }, [localJson, result, handleLocalJsonParse, format]);

  const handleCopy = useCallback(() => {
    const text = format === "json" ? JSON.stringify(result?.terraformJson, null, 2) : localHcl;
    navigator.clipboard.writeText(text);
    void logSimulationAction({ actionId: "simulation-terraform-copied", displayName: `Copied Terraform ${format.toUpperCase()} preview`, status: "completed", region, metadata: { format, nodeCount: nodes.length, edgeCount: edges.length } });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result, format, region, nodes.length, edges.length, localHcl]);

  const handleDownload = useCallback(() => {
    const text = format === "json" ? JSON.stringify(result?.terraformJson, null, 2) : localHcl;
    const blob = new Blob([text], { type: format === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = format === "json" ? "main.tf.json" : "main.tf"; a.click(); URL.revokeObjectURL(url);
    void logSimulationAction({ actionId: "simulation-terraform-downloaded", displayName: `Downloaded Terraform ${format.toUpperCase()} preview`, status: "completed", region, metadata: { format, nodeCount: nodes.length, edgeCount: edges.length } });
  }, [result, format, region, nodes.length, edges.length, localHcl]);

  const nodeToResources = useMemo(() => {
    if (!result?.resources) return [];
    return result.resources.map((r) => {
      const node = nodes.find((n) => n.id === r.serviceId || r.name.includes(n.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()));
      return { resource: r, nodeId: node?.id || "", nodeLabel: node?.data?.label && node.data.label.toLowerCase() !== r.name.toLowerCase() ? node.data.label : "" };
    });
  }, [result, nodes]);

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-black/30 dark:bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <AnimatePresence>
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 220 }}
          className="fixed right-0 top-0 z-[160] h-screen w-[min(520px,92vw)] border-l border-border bg-white/95 dark:bg-[#0B1728]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] flex flex-col min-w-0 overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-border px-6 py-4.5 shrink-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
              <Code className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-extrabold tracking-tight text-foreground font-sans">Terraform Configuration</h2>
              <p className="text-[11px] font-bold text-muted-foreground truncate">Generated from {nodes.length} nodes · {region}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden relative w-full">
            <div className="h-full w-full overflow-y-auto">
              <div className="space-y-6 px-6 py-5 pb-8 w-full min-w-0 overflow-x-hidden animate-none">
                <ResourceDetailsList validationErrors={validationErrors} result={result} nodeToResources={nodeToResources} resourceIcons={RESOURCE_ICONS} resourceTypeLabels={RESOURCE_TYPE_LABELS} serviceColors={serviceColors} />
                <CostEstimator nodes={nodes} edges={edges} region={region} provider={provider} />
                <CodeViewer format={format} setFormat={setFormat} code={format === "json" ? localJson : localHcl} onCodeChange={(newVal) => { lastUpdateSourceRef.current = "editor"; if (format === "json") setLocalJson(newVal); else setLocalHcl(newVal); }} handleDownload={handleDownload} handleCopy={handleCopy} copied={copied} onFocus={() => { isEditorFocusedRef.current = true; lastUpdateSourceRef.current = "editor"; }} onBlur={() => { isEditorFocusedRef.current = false; if (lastUpdateSourceRef.current === "canvas" && result) { setLocalHcl(result.terraformHcl); setLocalJson(JSON.stringify(result.terraformJson, null, 2)); } }} />
                {loading && <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground"><Code className="h-6 w-6 animate-spin text-primary" /><p className="text-xs font-bold animate-pulse font-sans">Syncing configuration...</p></div>}
                {apiError && <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-bold text-red-400 font-sans"><AlertCircle className="h-4.5 w-4.5 shrink-0" /> {apiError}</div>}
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-card/95 px-6 py-4.5 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold text-muted-foreground hidden xs:block font-sans">{nodes.length} nodes · {edges.length} edges</p>
            <div className="flex items-center gap-2">
              {result && <button type="button" onClick={handleDownload} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-[10px] font-black text-muted-foreground shadow-2xs transition hover:bg-muted hover:text-foreground cursor-pointer font-sans"><span>Download {format.toUpperCase()}</span></button>}
              {onDeploy && result && !validationErrors.length && <button onClick={onDeploy} className="simulation-action simulation-action-primary min-h-8.5 px-4 py-1.5 text-[10px] cursor-pointer rounded-lg font-black flex items-center gap-1.5 font-sans"><Rocket className="h-3.5 w-3.5" /> <span>Deploy Config</span></button>}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
