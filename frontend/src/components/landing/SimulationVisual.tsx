"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { Cpu, Github, HardDrive, Network, Scaling } from "@/icons";

type NodeId = "github" | "elb" | "ec2" | "asg" | "s3";

type SimulationNode = {
  id: NodeId;
  label: string;
  serviceId: string;
  icon: typeof Github;
  x: number;
  y: number;
  color: string;
  stats: string;
  tooltipAbove?: boolean;
};

type SimulationEdge = {
  id: string;
  from: NodeId;
  to: NodeId;
  path: string;
  delay: number;
};

const nodes: SimulationNode[] = [
  { id: "github", label: "Code Repo", serviceId: "github", icon: Github, x: 15, y: 110, color: "#64748B", stats: "Commits: 18 | Build: passing" },
  { id: "elb", label: "Load Balancer", serviceId: "elb", icon: Network, x: 175, y: 110, color: "#06B6D4", stats: "Requests: 8.4K | p95: 62ms" },
  { id: "ec2", label: "Compute Node", serviceId: "ec2", icon: Cpu, x: 335, y: 40, color: "#1A56DB", stats: "CPU: 42% | Latency: 48ms" },
  { id: "asg", label: "Auto-scaling", serviceId: "asg", icon: Scaling, x: 335, y: 180, color: "#F97316", stats: "Capacity: 6/10 | Healthy: 100%", tooltipAbove: true },
  { id: "s3", label: "Storage Node", serviceId: "s3", icon: HardDrive, x: 495, y: 110, color: "#22C55E", stats: "Objects: 2.1M | Egress: 18GB" },
];

const edges: SimulationEdge[] = [
  { id: "github-elb", from: "github", to: "elb", path: "M 135,130 L 175,130", delay: 0.18 },
  { id: "elb-ec2", from: "elb", to: "ec2", path: "M 295,130 C 310,130 320,60 335,60", delay: 0.72 },
  { id: "elb-asg", from: "elb", to: "asg", path: "M 295,130 C 310,130 320,200 335,200", delay: 0.82 },
  { id: "ec2-s3", from: "ec2", to: "s3", path: "M 455,60 C 470,60 480,130 495,130", delay: 1.32 },
  { id: "asg-s3", from: "asg", to: "s3", path: "M 455,200 C 470,200 480,130 495,130", delay: 1.42 },
];

const nodeDelays: Record<NodeId, number> = {
  github: 0.05,
  elb: 0.55,
  ec2: 1.08,
  asg: 1.18,
  s3: 1.72,
};

export function SimulationVisual() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeId | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(canvasRef, { once: true, amount: 0.35 });

  return (
    <div className="relative select-none rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1A56DB] dark:text-[#6BA3F8]">
          Interactive Canvas Simulation
        </p>
        <span className="flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[10px] font-bold text-[#1E40AF] dark:bg-blue-950/60 dark:text-blue-200">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
          </span>
          Simulating dry-run cost
        </span>
      </div>

      <div
        ref={canvasRef}
        className="relative h-60 w-full overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/50 shadow-inner dark:border-slate-800 dark:bg-slate-950/50"
      >
        <motion.svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 630 260"
          aria-label="Animated cloud architecture simulation"
          role="img"
        >
          <defs>
            <pattern id="landing-simulation-grid" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1" fill="#CBD5E1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#landing-simulation-grid)" opacity="0.72" />

          {edges.map((edge) => {
            const isConnected = hoveredNode === edge.from || hoveredNode === edge.to;
            const isDimmed = hoveredNode !== null && !isConnected;

            return (
              <g key={edge.id} className="pointer-events-none">
                <motion.path
                  d={edge.path}
                  stroke={isConnected ? "#93C5FD" : "#CBD5E1"}
                  strokeWidth={isConnected ? 5 : 2.5}
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: isInView ? 1 : 0,
                    opacity: isInView ? (isDimmed ? 0.28 : 1) : 0,
                  }}
                  transition={{
                    pathLength: {
                      duration: shouldReduceMotion ? 0 : 0.42,
                      delay: shouldReduceMotion ? 0 : edge.delay,
                      ease: [0.22, 1, 0.36, 1],
                    },
                    opacity: { duration: 0.2 },
                  }}
                />
                <motion.path
                  d={edge.path}
                  stroke={isConnected ? "#22D3EE" : "#3B82F6"}
                  strokeWidth={isConnected ? 3.75 : 2.5}
                  strokeDasharray="4 8"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: isInView ? 1 : 0,
                    strokeDashoffset: shouldReduceMotion ? 0 : -24,
                    opacity: isInView ? (isDimmed ? 0.18 : 1) : 0,
                  }}
                  transition={{
                    pathLength: {
                      duration: shouldReduceMotion ? 0 : 0.42,
                      delay: shouldReduceMotion ? 0 : edge.delay,
                      ease: [0.22, 1, 0.36, 1],
                    },
                    strokeDashoffset: {
                      duration: isConnected ? 0.7 : 1.5,
                      ease: "linear",
                      repeat: Infinity,
                    },
                    opacity: { duration: 0.2 },
                  }}
                />
              </g>
            );
          })}

          {nodes.map((node) => {
            const Icon = node.icon;
            const isHovered = hoveredNode === node.id;
            const objectY = node.tooltipAbove ? node.y - 38 : node.y;

            return (
              <foreignObject
                key={node.id}
                x={node.x - 8}
                y={objectY}
                width="136"
                height="84"
                className="overflow-visible"
              >
                <motion.div
                  className="relative h-full w-full px-2"
                  initial={{ opacity: 0, scale: 0.92, y: 8 }}
                  animate={{
                    opacity: isInView ? 1 : 0,
                    scale: isInView ? 1 : 0.92,
                    y: isInView ? 0 : 8,
                  }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.38,
                    delay: shouldReduceMotion ? 0 : nodeDelays[node.id],
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  onHoverStart={() => setHoveredNode(node.id)}
                  onHoverEnd={() => setHoveredNode(null)}
                  onFocus={() => setHoveredNode(node.id)}
                  onBlur={() => setHoveredNode(null)}
                >
                  <motion.button
                    type="button"
                    className={`absolute left-2 flex h-10 w-[120px] items-center gap-2 overflow-hidden rounded-md border bg-white/95 px-2 text-left shadow-sm outline-none backdrop-blur dark:bg-slate-900/95 ${
                      node.tooltipAbove ? "bottom-0" : "top-0"
                    }`}
                    style={{ borderColor: isHovered ? node.color : `${node.color}55` }}
                    animate={{
                      scale: isHovered ? 1.03 : 1,
                      boxShadow: isHovered
                        ? `0 0 0 1px ${node.color}66, 0 10px 28px ${node.color}38`
                        : "0 1px 3px rgba(15, 23, 42, 0.12)",
                    }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    aria-label={`${node.label}. ${node.stats}`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border"
                      style={{ color: node.color, borderColor: `${node.color}55`, backgroundColor: `${node.color}12` }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 leading-none">
                      <span className="flex items-center gap-1">
                        <span className="truncate text-[10px] font-extrabold text-slate-800 dark:text-slate-100">
                          {node.label}
                        </span>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: node.color }} />
                      </span>
                      <span className="mt-1 block text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                        {node.serviceId}
                      </span>
                    </span>
                  </motion.button>

                  <AnimatePresence>
                    {isHovered ? (
                      <motion.div
                        className={`pointer-events-none absolute left-1/2 z-30 w-max -translate-x-1/2 rounded-md border border-slate-700/20 bg-slate-950 px-2.5 py-1.5 text-[8px] font-bold text-white shadow-xl ${
                          node.tooltipAbove ? "top-0" : "bottom-0"
                        }`}
                        initial={{ opacity: 0, y: node.tooltipAbove ? 4 : -4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: node.tooltipAbove ? 4 : -4, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                      >
                        {node.stats}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              </foreignObject>
            );
          })}
        </motion.svg>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3.5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
            Simulation dry-run impact
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#0F172A] dark:text-slate-200">
            Optimizing compute and storage routes
          </p>
        </div>
        <div className="border-t border-slate-200 pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right dark:border-slate-700">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#22C55E]">
            Cost Difference
          </p>
          <p className="mt-1 whitespace-nowrap text-sm font-extrabold text-[#22C55E]">
            -$1,480.00 /mo
          </p>
        </div>
      </div>
    </div>
  );
}
