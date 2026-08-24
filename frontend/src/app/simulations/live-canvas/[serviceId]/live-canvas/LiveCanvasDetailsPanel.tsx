import type { Node as FlowNode } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "@/icons";
import { LiveCanvasAccessCards } from "./LiveCanvasAccessCards";
import { LiveCanvasActionControls } from "./LiveCanvasActionControls";
import { LiveCanvasEcrCommands } from "./LiveCanvasEcrCommands";
import { LiveCanvasLambdaCodeEditor } from "./LiveCanvasLambdaCodeEditor";
import { LiveCanvasMetrics } from "./LiveCanvasMetrics";
import { LiveCanvasResourceConfig } from "./LiveCanvasResourceConfig";

type LiveCanvasDetailsPanelProps = {
  selectedNode: FlowNode<any> | null;
  setSelectedNode: (node: FlowNode<any> | null) => void;
  region: string;
  copiedCmdIndex: number | null;
  handleCopyCmd: (cmd: string, idx: number) => void;
  sshKeyName: string;
  setSshKeyName: (value: string) => void;
  sshUsername: string;
  setSshUsername: (value: string) => void;
  httpCopied: boolean;
  handleCopyHttp: (url: string) => void;
  sshCopied: boolean;
  handleCopySsh: (cmd: string) => void;
  selectedProvider: string;
  lambdaFilename: string;
  isLambdaCodeLoading: boolean;
  lambdaCode: string | null;
  setLambdaCode: (value: string | null) => void;
  setIsCodeDirty: (value: boolean) => void;
  isCodeDirty: boolean;
  setDeployCodeModalOpen: (value: boolean) => void;
  isActionLoading: boolean;
  safetyCheck: {
    loading: boolean;
    isDeletable: boolean;
    reason: string | null;
    helperAction: string | null;
    helperLabel: string | null;
    warning: string | null;
  } | null;
  openActionModal: (action: string) => void;
  nodes: FlowNode<any>[];
  toggleRepoImages: (nodeId: string, images: any[], parentX: number, parentY: number) => void;
  expandedRepoId: string | null;
};

export function LiveCanvasDetailsPanel({
  selectedNode,
  setSelectedNode,
  region,
  copiedCmdIndex,
  handleCopyCmd,
  sshKeyName,
  setSshKeyName,
  sshUsername,
  setSshUsername,
  httpCopied,
  handleCopyHttp,
  sshCopied,
  handleCopySsh,
  selectedProvider,
  lambdaFilename,
  isLambdaCodeLoading,
  lambdaCode,
  setLambdaCode,
  setIsCodeDirty,
  isCodeDirty,
  setDeployCodeModalOpen,
  isActionLoading,
  safetyCheck,
  openActionModal,
  nodes,
  toggleRepoImages,
  expandedRepoId,
}: LiveCanvasDetailsPanelProps) {
  return (
    <>
      {selectedNode && selectedNode.data && (
        <div className="absolute top-0 right-0 z-50 h-full w-96 border-l border-border bg-card/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 transform translate-x-0 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <Badge variant="outline" className="mb-2 uppercase tracking-wider text-[10px] font-bold">
                {selectedNode.data.serviceId} Resource
              </Badge>
              <h2 className="text-xl font-extrabold text-foreground tracking-tight break-all">
                {selectedNode.data.label}
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)} className="h-8 w-8 p-0 shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4 space-y-6">
            <LiveCanvasResourceConfig selectedNode={selectedNode} />
            <LiveCanvasEcrCommands
              selectedNode={selectedNode}
              region={region}
              copiedCmdIndex={copiedCmdIndex}
              handleCopyCmd={handleCopyCmd}
            />
            <LiveCanvasAccessCards
              selectedNode={selectedNode}
              selectedProvider={selectedProvider}
              region={region}
              sshUsername={sshUsername}
              setSshUsername={setSshUsername}
              sshKeyName={sshKeyName}
              setSshKeyName={setSshKeyName}
              httpCopied={httpCopied}
              handleCopyHttp={handleCopyHttp}
              sshCopied={sshCopied}
              handleCopySsh={handleCopySsh}
            />
            <LiveCanvasLambdaCodeEditor
              serviceId={selectedNode.data.serviceId}
              selectedProvider={selectedProvider}
              lambdaFilename={lambdaFilename}
              isLambdaCodeLoading={isLambdaCodeLoading}
              lambdaCode={lambdaCode}
              setLambdaCode={setLambdaCode}
              setIsCodeDirty={setIsCodeDirty}
              isCodeDirty={isCodeDirty}
              setDeployCodeModalOpen={setDeployCodeModalOpen}
              isActionLoading={isActionLoading}
            />
            <LiveCanvasMetrics selectedNode={selectedNode} />
            <LiveCanvasActionControls
              selectedNode={selectedNode}
              selectedProvider={selectedProvider}
              safetyCheck={safetyCheck}
              isActionLoading={isActionLoading}
              openActionModal={openActionModal}
              nodes={nodes}
              toggleRepoImages={toggleRepoImages}
              expandedRepoId={expandedRepoId}
            />
          </div>
        </div>
      )}
    </>
  );
}
