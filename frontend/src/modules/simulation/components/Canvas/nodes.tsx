"use client";

import { memo, ElementType } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "reactflow";
import { Server, HardDrive, Database, Zap, StickyNote, Github, Network, Cloud, Container, Boxes, Gauge, Shield, Globe, FolderGit, ChevronDown, ChevronUp } from "@/icons";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const iconMap: Record<string, ElementType> = {
  Server,
  HardDrive,
  Database,
  Zap,
  Github,
  Network,
  Cloud,
  Container,
  Boxes,
  Gauge,
  Shield,
  Globe,
  FolderGit,
};

const colorMap: Record<
  string,
  { gradient: string; iconBg: string; iconText: string; handle: string; dot: string }
> = {
  github: {
    gradient: "from-slate-500/20 via-slate-500/5 to-transparent",
    iconBg: "bg-slate-500/15 border-slate-500/30",
    iconText: "text-slate-800 dark:text-slate-200",
    handle: "!border-slate-500/55 !bg-background hover:!bg-slate-500/15",
    dot: "bg-slate-500",
  },
  ec2: {
    gradient: "from-[#1A56DB]/25 via-[#06B6D4]/12 to-transparent",
    iconBg: "bg-[#1A56DB]/15 border-[#1A56DB]/35",
    iconText: "text-[#1A56DB]",
    handle: "!border-[#1A56DB]/60 !bg-background hover:!bg-[#1A56DB]/15",
    dot: "bg-[#1A56DB]",
  },
  s3: {
    gradient: "from-[#22C55E]/22 via-[#06B6D4]/10 to-transparent",
    iconBg: "bg-[#22C55E]/15 border-[#22C55E]/35",
    iconText: "text-[#16A34A]",
    handle: "!border-[#22C55E]/55 !bg-background hover:!bg-[#22C55E]/15",
    dot: "bg-[#22C55E]",
  },
  rds: {
    gradient: "from-[#F97316]/22 via-[#FB923C]/10 to-transparent",
    iconBg: "bg-[#F97316]/15 border-[#F97316]/35",
    iconText: "text-[#EA580C]",
    handle: "!border-[#F97316]/55 !bg-background hover:!bg-[#F97316]/15",
    dot: "bg-[#F97316]",
  },
  lambda: {
    gradient: "from-[#06B6D4]/25 via-[#1A56DB]/12 to-transparent",
    iconBg: "bg-[#06B6D4]/15 border-[#06B6D4]/40",
    iconText: "text-[#0891B2]",
    handle: "!border-[#06B6D4]/55 !bg-background hover:!bg-[#06B6D4]/15",
    dot: "bg-[#06B6D4]",
  },
  gcp_compute: {
    gradient: "from-[#4285F4]/24 via-[#34A853]/10 to-transparent",
    iconBg: "bg-[#4285F4]/15 border-[#4285F4]/35",
    iconText: "text-[#1A73E8]",
    handle: "!border-[#4285F4]/60 !bg-background hover:!bg-[#4285F4]/15",
    dot: "bg-[#4285F4]",
  },
  gcp_storage: {
    gradient: "from-[#34A853]/24 via-[#FBBC04]/10 to-transparent",
    iconBg: "bg-[#34A853]/15 border-[#34A853]/35",
    iconText: "text-[#188038]",
    handle: "!border-[#34A853]/55 !bg-background hover:!bg-[#34A853]/15",
    dot: "bg-[#34A853]",
  },
  gcp_sql: {
    gradient: "from-[#FBBC04]/24 via-[#4285F4]/10 to-transparent",
    iconBg: "bg-[#FBBC04]/15 border-[#FBBC04]/40",
    iconText: "text-[#B06000]",
    handle: "!border-[#FBBC04]/55 !bg-background hover:!bg-[#FBBC04]/15",
    dot: "bg-[#FBBC04]",
  },
  gcp_function: {
    gradient: "from-[#06B6D4]/24 via-[#34A853]/10 to-transparent",
    iconBg: "bg-[#06B6D4]/15 border-[#06B6D4]/40",
    iconText: "text-[#0891B2]",
    handle: "!border-[#06B6D4]/55 !bg-background hover:!bg-[#06B6D4]/15",
    dot: "bg-[#06B6D4]",
  },
  gcp_gke: {
    gradient: "from-[#6366F1]/24 via-[#4285F4]/10 to-transparent",
    iconBg: "bg-[#6366F1]/15 border-[#6366F1]/40",
    iconText: "text-[#4F46E5]",
    handle: "!border-[#6366F1]/55 !bg-background hover:!bg-[#6366F1]/15",
    dot: "bg-[#6366F1]",
  },
  elb: {
    gradient: "from-[#06B6D4]/25 via-[#1A56DB]/12 to-transparent",
    iconBg: "bg-[#06B6D4]/15 border-[#06B6D4]/40",
    iconText: "text-[#0891B2]",
    handle: "!border-[#06B6D4]/55 !bg-background hover:!bg-[#06B6D4]/15",
    dot: "bg-[#06B6D4]",
  },
  ecr: {
    gradient: "from-indigo-500/22 via-indigo-500/10 to-transparent",
    iconBg: "bg-indigo-500/15 border-indigo-500/35",
    iconText: "text-indigo-500",
    handle: "!border-indigo-500/55 !bg-background hover:!bg-indigo-500/15",
    dot: "bg-indigo-500",
  },
  azure_lb: {
    gradient: "from-[#0D9488]/25 via-[#06B6D4]/12 to-transparent",
    iconBg: "bg-[#0D9488]/15 border-[#0D9488]/40",
    iconText: "text-[#0D9488]",
    handle: "!border-[#0D9488]/55 !bg-background hover:!bg-[#0D9488]/15",
    dot: "bg-[#0D9488]",
  },
  gcp_lb: {
    gradient: "from-[#6366F1]/25 via-[#1A56DB]/12 to-transparent",
    iconBg: "bg-[#6366F1]/15 border-[#6366F1]/40",
    iconText: "text-[#4F46E5]",
    handle: "!border-[#6366F1]/55 !bg-background hover:!bg-[#6366F1]/15",
    dot: "bg-[#6366F1]",
  },
  asg: {
    gradient: "from-orange-500/22 via-orange-500/10 to-transparent",
    iconBg: "bg-orange-500/15 border-orange-500/35",
    iconText: "text-orange-500",
    handle: "!border-orange-500/55 !bg-background hover:!bg-orange-500/15",
    dot: "bg-orange-500",
  },
  azure_vmss: {
    gradient: "from-cyan-500/22 via-cyan-500/10 to-transparent",
    iconBg: "bg-cyan-500/15 border-cyan-500/35",
    iconText: "text-cyan-500",
    handle: "!border-cyan-500/55 !bg-background hover:!bg-cyan-500/15",
    dot: "bg-cyan-500",
  },
  gcp_mig: {
    gradient: "from-emerald-500/22 via-emerald-500/10 to-transparent",
    iconBg: "bg-emerald-500/15 border-emerald-500/35",
    iconText: "text-emerald-500",
    handle: "!border-emerald-500/55 !bg-background hover:!bg-emerald-500/15",
    dot: "bg-emerald-500",
  },
  eip: {
    gradient: "from-yellow-500/22 via-yellow-500/10 to-transparent",
    iconBg: "bg-yellow-500/15 border-yellow-500/35",
    iconText: "text-yellow-500",
    handle: "!border-yellow-500/55 !bg-background hover:!bg-yellow-500/15",
    dot: "bg-yellow-500",
  },
  azure_pip: {
    gradient: "from-yellow-500/22 via-yellow-500/10 to-transparent",
    iconBg: "bg-yellow-500/15 border-yellow-500/35",
    iconText: "text-yellow-500",
    handle: "!border-yellow-500/55 !bg-background hover:!bg-yellow-500/15",
    dot: "bg-yellow-500",
  },
  gcp_ip: {
    gradient: "from-yellow-500/22 via-yellow-500/10 to-transparent",
    iconBg: "bg-yellow-500/15 border-yellow-500/35",
    iconText: "text-yellow-500",
    handle: "!border-yellow-500/55 !bg-background hover:!bg-yellow-500/15",
    dot: "bg-yellow-500",
  },
  sg: {
    gradient: "from-rose-500/22 via-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/15 border-rose-500/35",
    iconText: "text-rose-500",
    handle: "!border-rose-500/55 !bg-background hover:!bg-rose-500/15",
    dot: "bg-rose-500",
  },
  azure_nsg: {
    gradient: "from-rose-500/22 via-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/15 border-rose-500/35",
    iconText: "text-rose-500",
    handle: "!border-rose-500/55 !bg-background hover:!bg-rose-500/15",
    dot: "bg-rose-500",
  },
  gcp_firewall: {
    gradient: "from-rose-500/22 via-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/15 border-rose-500/35",
    iconText: "text-rose-500",
    handle: "!border-rose-500/55 !bg-background hover:!bg-rose-500/15",
    dot: "bg-rose-500",
  },
  tg: {
    gradient: "from-orange-500/22 via-orange-500/10 to-transparent",
    iconBg: "bg-orange-500/15 border-orange-500/35",
    iconText: "text-orange-500",
    handle: "!border-orange-500/55 !bg-background hover:!bg-orange-500/15",
    dot: "bg-orange-500",
  },
  azure_tg: {
    gradient: "from-orange-500/22 via-orange-500/10 to-transparent",
    iconBg: "bg-orange-500/15 border-orange-500/35",
    iconText: "text-orange-500",
    handle: "!border-orange-500/55 !bg-background hover:!bg-orange-500/15",
    dot: "bg-orange-500",
  },
  gcp_tg: {
    gradient: "from-orange-500/22 via-orange-500/10 to-transparent",
    iconBg: "bg-orange-500/15 border-orange-500/35",
    iconText: "text-orange-500",
    handle: "!border-orange-500/55 !bg-background hover:!bg-orange-500/15",
    dot: "bg-orange-500",
  },
  ebs: {
    gradient: "from-slate-500/20 via-slate-500/5 to-transparent",
    iconBg: "bg-slate-500/15 border-slate-500/30",
    iconText: "text-slate-800 dark:text-slate-200",
    handle: "!border-slate-500/55 !bg-background hover:!bg-slate-500/15",
    dot: "bg-slate-500",
  },
  azure_disk: {
    gradient: "from-slate-500/20 via-slate-500/5 to-transparent",
    iconBg: "bg-slate-500/15 border-slate-500/30",
    iconText: "text-slate-800 dark:text-slate-200",
    handle: "!border-slate-500/55 !bg-background hover:!bg-slate-500/15",
    dot: "bg-slate-500",
  },
  gcp_disk: {
    gradient: "from-slate-500/20 via-slate-500/5 to-transparent",
    iconBg: "bg-slate-500/15 border-slate-500/30",
    iconText: "text-slate-800 dark:text-slate-200",
    handle: "!border-slate-500/55 !bg-background hover:!bg-slate-500/15",
    dot: "bg-slate-500",
  },
  cloudfront: {
    gradient: "from-purple-500/22 via-purple-500/10 to-transparent",
    iconBg: "bg-purple-500/15 border-purple-500/35",
    iconText: "text-purple-500",
    handle: "!border-purple-500/55 !bg-background hover:!bg-purple-500/15",
    dot: "bg-purple-500",
  },
  azure_cdn: {
    gradient: "from-purple-500/22 via-purple-500/10 to-transparent",
    iconBg: "bg-purple-500/15 border-purple-500/35",
    iconText: "text-purple-500",
    handle: "!border-purple-500/55 !bg-background hover:!bg-purple-500/15",
    dot: "bg-purple-500",
  },
  gcp_cdn: {
    gradient: "from-purple-500/22 via-purple-500/10 to-transparent",
    iconBg: "bg-purple-500/15 border-purple-500/35",
    iconText: "text-purple-500",
    handle: "!border-purple-500/55 !bg-background hover:!bg-purple-500/15",
    dot: "bg-purple-500",
  },
  vpc: {
    gradient: "from-[#06B6D4]/25 via-[#06B6D4]/10 to-transparent",
    iconBg: "bg-[#06B6D4]/15 border-[#06B6D4]/40",
    iconText: "text-[#0891B2]",
    handle: "!border-[#06B6D4]/55 !bg-background hover:!bg-[#06B6D4]/15",
    dot: "bg-[#06B6D4]",
  },
  aws_vpc: {
    gradient: "from-[#06B6D4]/25 via-[#06B6D4]/10 to-transparent",
    iconBg: "bg-[#06B6D4]/15 border-[#06B6D4]/40",
    iconText: "text-[#0891B2]",
    handle: "!border-[#06B6D4]/55 !bg-background hover:!bg-[#06B6D4]/15",
    dot: "bg-[#06B6D4]",
  },
  gcp_vpc: {
    gradient: "from-[#06B6D4]/25 via-[#06B6D4]/10 to-transparent",
    iconBg: "bg-[#06B6D4]/15 border-[#06B6D4]/40",
    iconText: "text-[#0891B2]",
    handle: "!border-[#06B6D4]/55 !bg-background hover:!bg-[#06B6D4]/15",
    dot: "bg-[#06B6D4]",
  },
  azure_vnet: {
    gradient: "from-[#0089D6]/25 via-[#0089D6]/10 to-transparent",
    iconBg: "bg-[#0089D6]/15 border-[#0089D6]/40",
    iconText: "text-[#0089D6]",
    handle: "!border-[#0089D6]/55 !bg-background hover:!bg-[#0089D6]/15",
    dot: "bg-[#0089D6]",
  },
  azure_vm: {
    gradient: "from-[#0089D6]/25 via-[#0089D6]/10 to-transparent",
    iconBg: "bg-[#0089D6]/15 border-[#0089D6]/40",
    iconText: "text-[#0089D6]",
    handle: "!border-[#0089D6]/55 !bg-background hover:!bg-[#0089D6]/15",
    dot: "bg-[#0089D6]",
  },
  azure_storage: {
    gradient: "from-[#0089D6]/25 via-[#0089D6]/10 to-transparent",
    iconBg: "bg-[#0089D6]/15 border-[#0089D6]/40",
    iconText: "text-[#0089D6]",
    handle: "!border-[#0089D6]/55 !bg-background hover:!bg-[#0089D6]/15",
    dot: "bg-[#0089D6]",
  },
  azure_aks: {
    gradient: "from-[#6366F1]/25 via-[#6366F1]/10 to-transparent",
    iconBg: "bg-[#6366F1]/15 border-[#6366F1]/40",
    iconText: "text-[#4F46E5]",
    handle: "!border-[#6366F1]/55 !bg-background hover:!bg-[#6366F1]/15",
    dot: "bg-[#6366F1]",
  },
};

export interface ServiceNodeData {
  serviceId: string;
  label: string;
  description: string;
  icon: string;
  colorKey: string;
  config: Record<string, unknown>;
  item?: any;
  metrics?: any;
  deploymentId?: string | null;
  isExpanded?: boolean;
  onToggleExpand?: (e: React.MouseEvent) => void;
}

export interface AnnotationNodeData {
  text: string;
  onTextChange?: (text: string) => void;
}

export const AnnotationNode = memo(function AnnotationNode({ data, selected }: NodeProps<AnnotationNodeData>) {
  return (
    <div
      className={[
        "relative h-full min-h-28 w-full min-w-56 rounded-lg border bg-[#FFFBEB] px-4 py-3 text-[#713F12] shadow-[0_14px_34px_rgba(180,83,9,0.16)] transition dark:border-[#78350F] dark:bg-[#451A03] dark:text-[#FDE68A]",
        selected ? "border-[#F59E0B] ring-2 ring-[#F59E0B]/35" : "border-[#FCD34D]",
      ].join(" ")}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={224}
        minHeight={112}
        lineClassName="!border-[#F59E0B]"
        handleClassName="!h-2.5 !w-2.5 !border-[#F59E0B] !bg-white"
      />
      <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em]">
        <StickyNote className="h-3.5 w-3.5" />
        Canvas Note
      </div>
      <textarea
        value={data.text}
        onChange={(event) => data.onTextChange?.(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        placeholder="Add architecture notes here"
        className="nodrag nowheel h-[calc(100%-1.75rem)] min-h-16 w-full resize-none rounded-md border border-[#FCD34D]/70 bg-white/55 px-2 py-1.5 text-sm font-semibold leading-snug text-[#713F12] outline-none placeholder:text-[#A16207]/60 focus:border-[#F59E0B] focus:bg-white dark:border-[#78350F] dark:bg-[#451A03]/60 dark:text-[#FDE68A] dark:placeholder:text-[#FDE68A]/45"
      />
    </div>
  );
});

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getConfiguredResourceName(serviceId: string, config?: Record<string, unknown>): string | undefined {
  if (!config) return undefined;
  const keys = [
    "instanceName",
    "lbName",
    "bucketName",
    "tableName",
    "functionName",
    "dbName",
    "vnetName",
    "clusterName",
    "distributionName",
    "endpointName",
    "cdnName",
  ];
  for (const k of keys) {
    if (config[k] && typeof config[k] === "string" && String(config[k]).trim() !== "") {
      return String(config[k]).trim();
    }
  }
  return undefined;
}

function getProviderLabel(serviceId?: string): string {
  if (!serviceId) return "Resource";
  if (serviceId.startsWith("azure_")) return "Azure";
  if (serviceId.startsWith("gcp_")) return "GCP";
  const awsServices = ["ec2", "rds", "s3", "lambda", "dynamodb", "elb", "asg", "cloudfront"];
  if (awsServices.includes(serviceId)) return "AWS";
  return "Resource";
}

export const ServiceNode = memo(function ServiceNode({ data, selected }: NodeProps<ServiceNodeData>) {
  const safeData = data || ({} as Partial<ServiceNodeData>);
  const palette = colorMap[safeData.colorKey || "ec2"] || colorMap.ec2;
  const Icon = iconMap[safeData.icon || "Server"] || Server;

  const resName = safeData.serviceId ? getConfiguredResourceName(safeData.serviceId, safeData.config) : undefined;
  const providerLabel = getProviderLabel(safeData.serviceId);
  const shortId = safeData.deploymentId ? `-${safeData.deploymentId.substring(0, 8)}` : "";
  const finalResName = resName ? `${resName}${shortId}` : undefined;

  const rawState = safeData.item?.state;
  const stateStr = safeData.item
    ? String(
        (typeof rawState === 'object' ? rawState?.name : rawState) ||
        safeData.item?.status ||
        safeData.item?.powerState ||
        ''
      ).trim()
    : "";

  const getStatusBadge = (state: string) => {
    const s = state.toLowerCase();
    let badgeClass = "bg-muted/50 text-muted-foreground border-border/50";
    let dotClass = "bg-muted-foreground";

    if (s.includes("running") || s.includes("online") || s === "available" || s === "ready" || s === "active") {
      badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      dotClass = "bg-emerald-500 animate-pulse";
    } else if (s.includes("stopped") || s.includes("paused") || s.includes("suspended") || s === "offline") {
      badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      dotClass = "bg-amber-500";
    } else if (s.includes("pending") || s.includes("starting") || s.includes("stopping") || s.includes("creating") || s.includes("updating") || s.includes("staging") || s.includes("restarting")) {
      badgeClass = "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      dotClass = "bg-blue-500 animate-ping";
    } else if (s.includes("deleting") || s.includes("deleted") || s.includes("terminated") || s.includes("fail")) {
      badgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      dotClass = "bg-rose-500";
    }

    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${badgeClass} shrink-0`}>
        <span className={`h-1 w-1 rounded-full ${dotClass}`} />
        {state}
      </span>
    );
  };

  const renderTooltipContent = () => {
    const lines = [];
    if (safeData.item) {
      if (safeData.item.type) lines.push(<div key="type"><span className="font-semibold">Type:</span> {safeData.item.type}</div>);
      if (safeData.item.state) lines.push(<div key="state"><span className="font-semibold">State:</span> {safeData.item.state}</div>);
      if (safeData.item.engine) lines.push(<div key="engine"><span className="font-semibold">Engine:</span> {safeData.item.engine}</div>);
      if (safeData.item.class) lines.push(<div key="class"><span className="font-semibold">Class:</span> {safeData.item.class}</div>);
      if (safeData.item.memory) lines.push(<div key="memory"><span className="font-semibold">Memory:</span> {safeData.item.memory} MB</div>);
      if (safeData.item.runtime) lines.push(<div key="runtime"><span className="font-semibold">Runtime:</span> {safeData.item.runtime}</div>);
    }
    if (safeData.metrics) {
      if (safeData.metrics.sizeBytes !== undefined) lines.push(<div key="size"><span className="font-semibold">Size:</span> {formatBytes(safeData.metrics.sizeBytes)}</div>);
      if (safeData.metrics.objectCount !== undefined) lines.push(<div key="objs"><span className="font-semibold">Objects:</span> {safeData.metrics.objectCount.toLocaleString()}</div>);
      if (safeData.metrics.cpu !== undefined) lines.push(<div key="cpu"><span className="font-semibold">CPU:</span> {safeData.metrics.cpu}%</div>);
      if (safeData.metrics.memory !== undefined) lines.push(<div key="mem_use"><span className="font-semibold">Memory Use:</span> {safeData.metrics.memory}%</div>);
      if (safeData.metrics.tasks !== undefined) lines.push(<div key="tasks"><span className="font-semibold">Tasks:</span> {safeData.metrics.tasks}</div>);
    }
    if (lines.length === 0) {
      return <div>No additional metrics available</div>;
    }
    return <div className="flex flex-col gap-1 py-1">{lines}</div>;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={[
              "relative w-[15.5rem] overflow-hidden rounded-lg border shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-md transition-[box-shadow,transform] duration-200 dark:shadow-[0_18px_48px_rgba(0,0,0,0.35)]",
              selected
                ? "border-[#1A56DB]/55 ring-2 ring-[#1A56DB]/45 ring-offset-2 ring-offset-background dark:border-[#6BA3F8]/45 dark:ring-[#6BA3F8]/35"
                : "border-[#DBEAFE]/90 dark:border-[#1e293b]",
            ].join(" ")}
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${palette.gradient} opacity-90`}
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(248,250,252,0.88)_55%,rgba(239,246,255,0.75)_100%)] dark:bg-[linear-gradient(145deg,rgba(11,23,40,0.97)_0%,rgba(7,17,31,0.92)_48%,rgba(16,33,58,0.88)_100%)]" />

            <Handle
              type="target"
              position={Position.Top}
              id={`${safeData.serviceId || "unknown"}-in`}
              className={`!h-2.5 !w-2.5 !rounded-full !border-2 ${palette.handle} !shadow-sm transition-colors`}
            />

            <div className="relative px-4 pb-3 pt-3.5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border shadow-sm ${palette.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${palette.iconText}`} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-extrabold tracking-tight text-foreground">{safeData.label || "Unknown Service"}</p>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full opacity-90 ring-2 ring-white/50 dark:ring-black/30 ${palette.dot}`} />
                    {safeData.onToggleExpand && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          safeData.onToggleExpand?.(e);
                        }}
                        className="ml-auto inline-flex items-center gap-1 justify-center rounded-md border border-indigo-500/35 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 shadow-sm transition-colors cursor-pointer select-none"
                        title={safeData.isExpanded ? "Hide images on canvas" : "Show images on canvas"}
                      >
                        {safeData.isExpanded ? (
                          <>
                            Collapse
                            <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            Images
                            <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {finalResName && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-muted-foreground shrink-0">
                        {providerLabel} Name:
                      </span>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border truncate max-w-[130px] ${palette.iconBg} ${palette.iconText}`} title={`${providerLabel} Resource Name`}>
                        {finalResName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground truncate">
                      {safeData.serviceId || "unknown"}
                    </p>
                    {stateStr && getStatusBadge(stateStr)}
                  </div>
                </div>
              </div>

              <p className="relative mt-3 text-[11px] leading-snug text-muted-foreground">{safeData.description || "No description available"}</p>
            </div>

            <Handle
              type="source"
              position={Position.Bottom}
              id={`${safeData.serviceId || "unknown"}-out`}
              className={`!h-2.5 !w-2.5 !rounded-full !border-2 ${palette.handle} !shadow-sm transition-colors`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={15} className="min-w-[150px]">
          {renderTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export const nodeTypes = {
  service: ServiceNode,
  annotation: AnnotationNode,
};
