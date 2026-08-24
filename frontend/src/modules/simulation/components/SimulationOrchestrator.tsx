"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Cloud,
  Loader2,
  Check,
  StickyNote,
  Network,
  Code,
  Rocket,
  Server,
  AlertCircle,
} from "@/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MultiStepLoader } from "@/components/MultiStepLoader";

import { useSimulation } from "../hooks/useSimulation";
import { Canvas } from "./Canvas/Canvas";
import { Toolbar } from "./Toolbar/Toolbar";
import { NodeConfigPanel } from "./NodePanel/NodeConfigPanel";
import { FloatingCostBox } from "./Preview/FloatingCostBox";
import { TerraformPreviewPanel } from "./Preview/TerraformPreviewPanel";
import { DeploymentStatusPanel } from "./Preview/DeploymentStatusPanel";

export function SimulationOrchestrator() {
  const sim = useSimulation();

  return (
    <div className="simulation-surface relative flex h-full w-full overflow-hidden">
      {/* ─── Loader Phase ─── */}
      <AnimatePresence>
        {sim.phase === "loading" && (
          <div className="relative z-100">
            <MultiStepLoader
              steps={sim.loaderSteps.length ? sim.loaderSteps : [{ title: "Initializing..." }]}
              currentStep={Math.min(sim.completedStepCount, sim.loaderSteps.length)}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed bottom-12 left-1/2 z-110 -translate-x-1/2"
            >
              <button
                onClick={sim.handleCancelSimulation}
                className="rounded-full border border-border bg-card/80 px-6 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md transition hover:bg-muted hover:text-foreground"
              >
                Cancel Simulation
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Error Phase ─── */}
      <AnimatePresence>
        {sim.phase === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[190] flex items-center justify-center bg-background/60 backdrop-blur-xs select-text"
          >
            <div className="simulation-card w-full max-w-md rounded-2xl p-6 text-center shadow-2xl space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-6 w-6 text-red-500 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
                  Simulation failed
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {sim.errorMessage}
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Link
                  href="/dashboard"
                  className="simulation-action text-xs font-bold px-4 py-2 hover:bg-muted/80 transition"
                >
                  Return to Dashboard
                </Link>
                <button
                  onClick={sim.startSimulationSession}
                  className="simulation-action simulation-action-primary text-xs font-bold px-4 py-2"
                >
                  Retry
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Canvas Phase ─── */}
      {sim.phase === "ready" && (
        <>
          {/* Top bar */}
          <div className="simulation-topbar absolute left-0 right-0 top-0 z-80 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link
                href="/simulations"
                className="simulation-action min-h-9 shrink-0 px-3 py-1.5 text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </Link>

              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="text"
                  value={sim.name}
                  onChange={(e) => sim.setName(e.target.value)}
                  className="w-full max-w-sm rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-extrabold text-foreground outline-none transition hover:border-border focus:border-primary/30 focus:bg-card"
                  placeholder="Simulation Name"
                />
                <div className="flex items-center text-[#64748B] dark:text-[#94A3B8]" title={`Status: ${sim.syncState}`}>
                  {sim.syncState === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#1A56DB] dark:text-[#3B82F6]" />
                  ) : sim.syncState === "saved" ? (
                    <div className="flex items-center gap-1 text-[#22C55E]">
                      <Cloud className="h-4 w-4" />
                      <Check className="absolute h-2 w-2" style={{ marginLeft: "4px", marginTop: "2px" }} />
                    </div>
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="simulation-card-subtle flex items-center gap-1 rounded-lg p-1">
                {(["azure", "aws", "gcp"] as const).map((provider) => {
                  const locked =
                    sim.nodes.some((node) => node.type === "service" && node.data?.serviceId !== "github") &&
                    provider !== sim.activeServiceProvider;
                  const active = provider === sim.activeServiceProvider;
                  return (
                    <button
                      key={provider}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        sim.setPickerProvider(provider);
                      }}
                      className={`rounded-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      }`}
                    >
                      {provider}
                    </button>
                  );
                })}
              </div>
              <div className="simulation-card-subtle flex items-center gap-2 rounded-lg px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  <Server className="h-3.5 w-3.5" />
                  {sim.session?.orchestrator === "ecs" ? "ECS Engine" : "Local Engine"}
                </span>
                <div className="h-3 w-px bg-border" />
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  {sim.nodes.length} node{sim.nodes.length !== 1 ? "s" : ""}
                </span>
              </div>

              <ThemeToggle />

              <button onClick={sim.addAnnotation} className="simulation-action">
                <StickyNote className="h-4 w-4" />
                <span className="hidden sm:inline">Note</span>
              </button>
              {sim.nodes.length > 0 && (
                <button onClick={sim.autoLayoutNodes} className="simulation-action">
                  <Network className="h-4 w-4" />
                  <span className="hidden sm:inline">Auto Layout</span>
                </button>
              )}
              <button onClick={sim.handleOpenTerraform} className="simulation-action">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">HCL</span>
              </button>
              {sim.nodes.length > 0 && (
                <button onClick={sim.handleOpenDeploy} className="simulation-action simulation-action-primary">
                  <Rocket className="h-4 w-4" />
                  <span className="hidden sm:inline">Deploy</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Toolbar */}
          <div className="fixed left-1/2 top-20 z-90 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2">
            <Toolbar onAdd={sim.addNode} provider={sim.activeServiceProvider} />
          </div>

          {/* Flow Canvas */}
          <Canvas
            nodes={sim.renderedNodes}
            edges={sim.edges}
            onNodesChange={sim.onNodesChange}
            onEdgesChange={sim.onEdgesChange}
            onConnect={sim.onConnect}
            onNodeDragStart={sim.takeSnapshot}
            onInit={sim.setReactFlowInstance}
            onNodeClick={sim.onNodeClick}
            onPaneClick={sim.onPaneClick}
            undo={sim.undo}
            redo={sim.redo}
            canUndo={sim.canUndo}
            canRedo={sim.canRedo}
            clearCanvas={sim.clearCanvas}
            selectedNodeId={sim.selectedNodeId}
          />

          {/* Configuration Panel */}
          {sim.selectedNode && (
            <NodeConfigPanel
              nodeId={sim.selectedNode.id}
              nodeData={sim.selectedNode.data}
              onSave={sim.handleConfigSave}
              onClose={sim.handleConfigClose}
              outputs={
                sim.simulation?.terraform?.outputs ||
                sim.simulation?.deployments?.find((d: any) => d.status === "active")?.outputs
              }
            />
          )}

          {/* Floating Cost Estimate Pill */}
          <FloatingCostBox
            nodes={sim.nodes
              .filter((n) => n.data?.serviceId)
              .map((n) => ({
                id: n.id,
                serviceId: n.data.serviceId as any,
                config: n.data.config,
              }))}
            edges={sim.edges.map((e) => ({ source: e.source, target: e.target }))}
            region={sim.derivedRegion}
            sessionId={sim.session?.id || "sim"}
          />

          {/* Terraform preview panel */}
          {sim.showTerraform && (
            <TerraformPreviewPanel
              nodes={sim.nodes}
              setNodes={sim.setNodes}
              edges={sim.edges}
              setEdges={sim.setEdges}
              region={sim.derivedRegion}
              provider={sim.derivedProvider}
              onClose={sim.handleCloseTerraform}
              onDeploy={sim.handleOpenDeploy}
            />
          )}

          {/* Deployment panel */}
          {sim.showDeploy && (
            <DeploymentStatusPanel
              nodes={sim.nodes.filter((n) => n.data?.serviceId)}
              edges={sim.edges}
              region={sim.derivedRegion}
              draftId={sim.draftId}
              name={sim.name}
              provider={sim.derivedProvider}
              onClose={sim.handleCloseDeploy}
              onDeploymentIdChange={sim.setDeploymentId}
            />
          )}
        </>
      )}
    </div>
  );
}
