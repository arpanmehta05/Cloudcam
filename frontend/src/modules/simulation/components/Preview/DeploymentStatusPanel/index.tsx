"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useDeploymentState } from "./useDeploymentState";
import { AccountInfoBar } from "./AccountInfoBar";
import { ActiveDeploymentTabs } from "./ActiveDeploymentTabs";
import { CredentialPhaseSection } from "./CredentialPhaseSection";
import { PanelFooter } from "./PanelFooter";
import { PanelHeader } from "./PanelHeader";
import { PhaseLoadingState } from "./PhaseLoadingState";
import { ValidatedSection } from "./ValidatedSection";
import { VisualStepper } from "./VisualStepper";

interface DeploymentStatusPanelProps {
  region: string;
  provider: "aws" | "azure" | "gcp";
  onClose: () => void;
  nodes?: any[];
  edges?: any[];
  draftId?: string | null;
  name?: string;
  deploymentId?: string;
  action?: string;
  resourceLabel?: string;
  service?: string;
  resourceId?: string;
  mode?: "simulation" | "live-action";
  onDeploymentIdChange?: (id: string | null) => void;
}

const activeRunnerPhases = [
  "awaiting_image_upload",
  "running",
  "complete",
  "failed",
];

export function DeploymentStatusPanel(props: DeploymentStatusPanelProps) {
  const {
    provider,
    onClose,
    mode = "simulation",
    action = "deploy",
    resourceLabel = "resources",
    nodes = [],
    region,
    draftId,
    name,
    service,
  } = props;

  const state = useDeploymentState({ ...props, onClose });

  return (
    <>
      <div
        className="fixed inset-0 z-[150] bg-slate-950/40 backdrop-blur-xs"
        onClick={state.allowBackdropClose ? onClose : undefined}
      />

      <AnimatePresence>
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="simulation-card fixed bottom-0 right-0 top-0 z-[160] h-screen w-[min(540px,92vw)] rounded-none border-y-0 border-r-0 flex flex-col shadow-2xl bg-background/95 backdrop-blur-md overflow-x-hidden"
        >
          <PanelHeader
            mode={mode}
            action={action}
            resourceLabel={resourceLabel}
            resourceCount={nodes.length}
            region={region}
            onClose={onClose}
          />

          <ScrollArea className="flex-1 min-h-0 px-5 py-4 animate-none">
            <VisualStepper steps={state.steps} activeStep={state.activeStep} />

            <AccountInfoBar
              provider={provider}
              accountInfo={state.accountInfo}
              formRegion={state.formRegion}
              maskId={state.maskId}
            />

            {state.phase === "starting" && (
              <PhaseLoadingState
                title="Preparing Deployment Session"
                description="We are initializing a secure Docker runner container to compile HCL configurations..."
                spacious
              />
            )}

            {state.phase === "creds" && (
              <CredentialPhaseSection provider={provider} state={state} />
            )}

            {state.phase === "validated" && (
              <ValidatedSection
                nodes={nodes}
                mode={mode}
                action={action}
                formRegion={state.formRegion}
                accountInfo={state.accountInfo}
                handleDeploy={state.handleDeploy}
                setPhase={state.setPhase}
                setAccountInfo={state.setAccountInfo}
                setRegionLocked={state.setRegionLocked}
                maskId={state.maskId}
              />
            )}

            {state.phase === "validating" && (
              <PhaseLoadingState
                title="Validating Cloud Credentials"
                description="Contacting provider APIs to verify resource manager authorization keys..."
              />
            )}

            {activeRunnerPhases.includes(state.phase) && (
              <ActiveDeploymentTabs
                state={state}
                mode={mode}
                action={action}
                resourceLabel={resourceLabel}
                service={service}
                name={name}
                draftId={draftId}
                onClose={onClose}
              />
            )}
          </ScrollArea>

          <PanelFooter />
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default DeploymentStatusPanel;
