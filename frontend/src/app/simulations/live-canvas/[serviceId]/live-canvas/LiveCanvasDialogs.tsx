import type { Node as FlowNode } from "reactflow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LiveActionDeploymentPanel } from "../../LiveActionDeploymentPanel";

type ActionPayload = { action: string; label: string; region: string };

type LiveCanvasDialogsProps = {
  deployCodeModalOpen: boolean;
  setDeployCodeModalOpen: (value: boolean) => void;
  selectedNode: FlowNode<any> | null;
  confirmCodeDeployment: () => void;
  isActionLoading: boolean;
  actionModalOpen: boolean;
  setActionModalOpen: (value: boolean) => void;
  actionPayload: ActionPayload | null;
  viewRegion: string;
  rawInventory: any;
  selectedInstanceId: string;
  setSelectedInstanceId: (value: string) => void;
  confirmNodeAction: () => void;
  activeDeploymentId: string | null;
  serviceId: string;
  selectedProvider: "aws" | "azure" | "gcp";
  setActiveDeploymentId: (value: string | null) => void;
  setActionPayload: (value: ActionPayload | null) => void;
  fetchInventory: (forceRefresh?: boolean) => void;
};

export function LiveCanvasDialogs({
  deployCodeModalOpen,
  setDeployCodeModalOpen,
  selectedNode,
  confirmCodeDeployment,
  isActionLoading,
  actionModalOpen,
  setActionModalOpen,
  actionPayload,
  viewRegion,
  rawInventory,
  selectedInstanceId,
  setSelectedInstanceId,
  confirmNodeAction,
  activeDeploymentId,
  serviceId,
  selectedProvider,
  setActiveDeploymentId,
  setActionPayload,
  fetchInventory,
}: LiveCanvasDialogsProps) {
  return (
    <>
        <Dialog open={deployCodeModalOpen} onOpenChange={setDeployCodeModalOpen}>
          <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border">
            <DialogHeader>
              <DialogTitle className="text-xl">Confirm Code Deployment</DialogTitle>
              <DialogDescription>
                Are you sure you want to deploy these code changes directly to the live AWS Lambda function <strong>{selectedNode?.data?.label}</strong>?
                <span className="block mt-2 text-red-500 font-medium font-semibold">
                  This will package your code and run Terraform to update the function's deployment package in AWS. This action will update the live environment.
                </span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-4 gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDeployCodeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={confirmCodeDeployment}
                disabled={isActionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isActionLoading ? "Deploying..." : "Confirm & Deploy"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
          <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border">
            <DialogHeader>
              <DialogTitle className="text-xl">Confirm Action</DialogTitle>
              <DialogDescription>
                {actionPayload?.action === 'associate' ? (
                  <>
                    Select an EC2 instance in <strong>{actionPayload?.region}</strong> to associate with the Elastic IP <strong>{actionPayload?.label}</strong>.
                  </>
                ) : (
                  <>
                    {selectedNode?.data?.serviceId === 'ecr_image' ? (
                      actionPayload?.action === 'archive' ? (
                        <>
                          Are you sure you want to <strong>archive</strong> the image <strong>{actionPayload?.label}</strong>?
                          <span className="block mt-2 text-amber-500 font-medium font-semibold">
                            This will copy the image manifest to tags prefixed with 'archived' and remove its active tags, untagging the image.
                          </span>
                        </>
                      ) : actionPayload?.action === 'unarchive' ? (
                        <>
                          Are you sure you want to <strong>unarchive</strong> the image <strong>{actionPayload?.label}</strong>?
                          <span className="block mt-2 text-emerald-500 font-medium font-semibold">
                            This will copy the image manifest back to its original active tags and delete the 'archived' tags.
                          </span>
                        </>
                      ) : (
                        <>
                          Are you sure you want to <strong>delete</strong> the image <strong>{actionPayload?.label}</strong>?
                          <span className="block mt-2 text-red-500 font-medium font-semibold">
                            This action cannot be undone. This will permanently delete this specific image digest from ECR.
                          </span>
                        </>
                      )
                    ) : (
                      <>
                        Are you sure you want to <strong>{actionPayload?.action}</strong> the resource <strong>{actionPayload?.label}</strong>?
                        {actionPayload?.action === 'terminate' || actionPayload?.action === 'delete' ? (
                          <span className="block mt-2 text-red-500 font-medium">
                            This action cannot be undone. {selectedNode?.data?.serviceId === 'ecr' && "This will force-delete the repository along with all of its images."}
                          </span>
                        ) : null}
                      </>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {actionPayload?.action === 'associate' && (
              <div className="my-4 space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  EC2 Instance
                </label>
                {(() => {
                  const resourceRegion = selectedNode?.data?.item?.region || viewRegion;
                  const availableInstances = (rawInventory?.ec2 || []).filter(
                    (inst: any) => inst.region === resourceRegion
                  );
                  
                  if (availableInstances.length === 0) {
                    return (
                      <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        No EC2 instances found in region <strong>{resourceRegion}</strong>. You must create or have an EC2 instance in this region to associate an Elastic IP.
                      </p>
                    );
                  }
                  
                  return (
                    <select
                      value={selectedInstanceId}
                      onChange={(e) => setSelectedInstanceId(e.target.value)}
                      className="w-full h-10 rounded border border-border bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="" disabled>Select an instance...</option>
                      {availableInstances.map((inst: any) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name === inst.id ? inst.id : `${inst.name} (${inst.id})`}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            )}

            <DialogFooter className="mt-4 gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setActionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={actionPayload?.action === 'terminate' || actionPayload?.action === 'delete' ? "destructive" : "default"}
                onClick={confirmNodeAction}
                disabled={isActionLoading || (actionPayload?.action === 'associate' && !selectedInstanceId)}
                className={actionPayload?.action === 'start' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                {isActionLoading ? "Processing..." : "Confirm Action"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {activeDeploymentId && actionPayload && (
          <LiveActionDeploymentPanel
            deploymentId={activeDeploymentId}
            action={actionPayload.action}
            resourceLabel={actionPayload.label}
            region={actionPayload.region}
            service={serviceId}
            resourceId={selectedNode?.data?.item?.id || selectedNode?.data?.item?.name || selectedNode?.id}
            provider={selectedProvider}
            onClose={() => {
              setActiveDeploymentId(null);
              setActionPayload(null);
              fetchInventory(true); // Refresh after completion
            }}
          />
        )}
    </>
  );
}
