import type { Node as FlowNode } from "reactflow";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
} from "@/icons";

type SafetyCheck = {
  loading: boolean;
  isDeletable: boolean;
  reason: string | null;
  helperAction: string | null;
  helperLabel: string | null;
  warning: string | null;
} | null;

type LiveCanvasActionControlsProps = {
  selectedNode: FlowNode<any>;
  selectedProvider: string;
  safetyCheck: SafetyCheck;
  isActionLoading: boolean;
  openActionModal: (action: string) => void;
  nodes: FlowNode<any>[];
  toggleRepoImages: (nodeId: string, images: any[], parentX: number, parentY: number) => void;
  expandedRepoId: string | null;
};

export function LiveCanvasActionControls({
  selectedNode,
  selectedProvider,
  safetyCheck,
  isActionLoading,
  openActionModal,
  nodes,
  toggleRepoImages,
  expandedRepoId,
}: LiveCanvasActionControlsProps) {
  return (
    <div className="space-y-3 pt-4 border-t border-border/50">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</h3>
      
      {safetyCheck?.loading && (
        <div className="flex items-center justify-center p-3 text-xs text-muted-foreground bg-muted/20 border border-border/30 rounded-lg gap-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" />
          Checking deletion prerequisites...
        </div>
      )}

      {safetyCheck && !safetyCheck.loading && (
        <div className="space-y-2 mb-2">
          {!safetyCheck.isDeletable && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2 text-xs text-red-200">
              <div className="flex gap-2 items-start font-medium text-red-400">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block uppercase text-[10px] tracking-wider text-red-500">Prerequisite Required</span>
                  {safetyCheck.reason}
                </div>
              </div>
              {safetyCheck.helperAction && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-1.5 py-1 text-xs"
                  disabled={isActionLoading}
                  onClick={() => openActionModal(safetyCheck.helperAction!)}
                >
                  <Play className="h-3 w-3" /> Resolve: {safetyCheck.helperLabel}
                </Button>
              )}
            </div>
          )}
          {safetyCheck.isDeletable && safetyCheck.warning && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2 items-start text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block uppercase text-[10px] tracking-wider text-amber-500">Warning Disclaimer</span>
                {safetyCheck.warning}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {selectedProvider !== "aws" && selectedProvider !== "azure" && selectedProvider !== "gcp" ? (
          <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border text-center">
            {String(selectedProvider).toUpperCase()} resources are read-only in this phase.
          </div>
        ) : (
           <>
          {(selectedNode.data.serviceId === 'ec2' || selectedNode.data.serviceId === 'azure_vm' || selectedNode.data.serviceId === 'gcp_compute') && (() => {
              const rawState = selectedNode.data.item?.state;
              const stateStr = String(
                (typeof rawState === 'object' ? rawState?.name : rawState) ||
                selectedNode.data.item?.status ||
                selectedNode.data.item?.powerState ||
                'unknown'
              ).toLowerCase();
              const isRunning = stateStr.includes('running') || stateStr.includes('pending') || stateStr.includes('starting') || stateStr.includes('staging');
              const isStopped = stateStr.includes('stopped') || stateStr.includes('deallocated') || stateStr.includes('terminated') || stateStr.includes('suspended');
              const isTerminated = stateStr.includes('deleting') || stateStr.includes('deleted');

              if (isTerminated) return (
                <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border text-center">
                  Resource is {stateStr}. No actions available.
                </div>
              );

              return (
                 <>
                    {isRunning && (
                       <Button variant="outline" className="w-full justify-start text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" disabled={isActionLoading} onClick={() => openActionModal('stop')}>
                          <XCircle className="mr-2 h-4 w-4" /> Stop Instance
                       </Button>
                    )}
                    {isStopped && (
                       <Button variant="outline" className="w-full justify-start text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" disabled={isActionLoading} onClick={() => openActionModal('start')}>
                          <Play className="mr-2 h-4 w-4" /> Start Instance
                       </Button>
                    )}
                    {isRunning && (
                       <Button variant="outline" className="w-full justify-start text-blue-500 hover:text-blue-600 hover:bg-blue-500/10" disabled={isActionLoading} onClick={() => openActionModal('restart')}>
                          <RefreshCw className="mr-2 h-4 w-4" /> Restart Instance
                       </Button>
                    )}
                    <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal(selectedProvider === 'azure' || selectedProvider === 'gcp' ? 'delete' : 'terminate')}>
                       <Trash2 className="mr-2 h-4 w-4" /> {selectedProvider === 'azure' || selectedProvider === 'gcp' ? 'Delete VM' : 'Terminate Instance'}
                    </Button>
                 </>
              );
          })()}
          {(selectedNode.data.serviceId === 's3' || selectedNode.data.serviceId === 'dynamodb' || selectedNode.data.serviceId === 'azure_storage' || selectedNode.data.serviceId === 'gcp_storage') && (
             <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                <Trash2 className="mr-2 h-4 w-4" /> {selectedNode.data.serviceId === 'azure_storage' ? 'Delete Storage Account' : selectedNode.data.serviceId === 'gcp_storage' ? 'Delete Storage Bucket' : 'Delete Resource'}
             </Button>
          )}
          {(selectedNode.data.serviceId === 'rds' || selectedNode.data.serviceId === 'azure_sql' || selectedNode.data.serviceId === 'gcp_sql') && (() => {
              const isSnapshot = selectedNode.data.item?.type === 'snapshot';
              const stateStr = String(selectedNode.data.item?.status || selectedNode.data.item?.state || 'unknown').toLowerCase();
              const isAvailable = stateStr === 'available' || stateStr === 'backing-up' || stateStr === 'online' || stateStr === 'ready' || stateStr === 'runnable';
              const isStopped = stateStr === 'stopped' || stateStr === 'paused' || stateStr === 'suspended';
              const isDeleted = stateStr === 'deleted' || stateStr === 'deleting';

              if (isDeleted) return (
                <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border text-center">
                  Resource is {stateStr}. No actions available.
                </div>
              );

              if (isSnapshot) {
                return (
                  <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                     <Trash2 className="mr-2 h-4 w-4" /> Delete Snapshot
                  </Button>
                );
              }

              return (
                 <>
                    {selectedProvider === "aws" && isAvailable && (
                       <Button variant="outline" className="w-full justify-start text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" disabled={isActionLoading} onClick={() => openActionModal('stop')}>
                          <XCircle className="mr-2 h-4 w-4" /> Stop Database
                       </Button>
                    )}
                    {selectedProvider === "aws" && isStopped && (
                       <Button variant="outline" className="w-full justify-start text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" disabled={isActionLoading} onClick={() => openActionModal('start')}>
                          <Play className="mr-2 h-4 w-4" /> Start Database
                       </Button>
                    )}
                    <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                       <Trash2 className="mr-2 h-4 w-4" /> Delete Database
                    </Button>
                 </>
              );
          })()}
          {(selectedNode.data.serviceId === 'lambda' || selectedNode.data.serviceId === 'azure_function' || selectedNode.data.serviceId === 'gcp_function') && (
             <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                <Trash2 className="mr-2 h-4 w-4" /> {selectedNode.data.serviceId === 'azure_function' ? 'Delete Function App' : selectedNode.data.serviceId === 'gcp_function' ? 'Delete Cloud Function' : 'Delete Function'}
             </Button>
          )}
          {selectedNode.data.serviceId === 'gcp_gke' && (
             <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete GKE Cluster
             </Button>
          )}
          {selectedNode.data.serviceId === 'azure_vnet' && (
             <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Virtual Network
             </Button>
          )}
          {selectedNode.data.serviceId === 'eip' && (
             <>
                {selectedNode.data.item?.associationId ? (
                   <Button variant="outline" className="w-full justify-start text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" disabled={isActionLoading} onClick={() => openActionModal('disassociate')}>
                      <XCircle className="mr-2 h-4 w-4" /> Disassociate IP
                   </Button>
                ) : (
                   <Button variant="outline" className="w-full justify-start text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" disabled={isActionLoading} onClick={() => openActionModal('associate')}>
                      <Server className="mr-2 h-4 w-4" /> Associate IP
                   </Button>
                )}
                <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('release')}>
                   <Trash2 className="mr-2 h-4 w-4" /> Release Elastic IP
                </Button>
             </>
          )}
          {selectedNode.data.serviceId === 'sg' && (
             <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Security Group
             </Button>
          )}
          {selectedNode.data.serviceId === 'tg' && (
             <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Target Group
             </Button>
          )}
          {selectedNode.data.serviceId === 'apigateway' && (
             <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete API Gateway
             </Button>
          )}
          {selectedNode.data.serviceId === 'ecr' && (
             <>
                <Button
                  variant="outline"
                  className="w-full justify-start text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                  disabled={isActionLoading}
                  onClick={() => {
                    const currNode = nodes.find((n) => n.id === selectedNode.id);
                    toggleRepoImages(
                      selectedNode.id,
                      selectedNode.data.images || [],
                      currNode ? currNode.position.x : selectedNode.position.x,
                      currNode ? currNode.position.y : selectedNode.position.y
                    );
                  }}
                >
                  {expandedRepoId === selectedNode.id ? (
                    <><ChevronUp className="mr-2 h-4 w-4" /> Hide Images on Canvas</>
                  ) : (
                    <><ChevronDown className="mr-2 h-4 w-4" /> Show Images on Canvas</>
                  )}
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                   <Trash2 className="mr-2 h-4 w-4" /> Delete Repository
                </Button>
             </>
          )}
          {selectedNode.data.serviceId === 'ecr_image' && (() => {
             const isImageArchived = selectedNode.data.item?.tags?.split(",").map((t: string) => t.trim()).includes("archived");
             return (
               <>
                  {isImageArchived ? (
                     <Button variant="outline" className="w-full justify-start text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" disabled={isActionLoading} onClick={() => openActionModal('unarchive')}>
                        <Archive className="mr-2 h-4 w-4" /> Unarchive Image
                     </Button>
                  ) : (
                     <Button variant="outline" className="w-full justify-start text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" disabled={isActionLoading} onClick={() => openActionModal('archive')}>
                        <Archive className="mr-2 h-4 w-4" /> Archive Image
                     </Button>
                  )}
                  <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                     <Trash2 className="mr-2 h-4 w-4" /> Delete Image
                  </Button>
               </>
             );
          })()}
           {selectedNode.data.serviceId === 'cloudfront' && (() => {
              const isEnabled = selectedNode.data.item?.enabled === true;
              return (
                 <>
                    {isEnabled ? (
                       <Button variant="outline" className="w-full justify-start text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" disabled={isActionLoading} onClick={() => openActionModal('disable')}>
                          <XCircle className="mr-2 h-4 w-4" /> Disable Distribution
                       </Button>
                    ) : (
                       <Button variant="outline" className="w-full justify-start text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" disabled={isActionLoading} onClick={() => openActionModal('enable')}>
                          <Play className="mr-2 h-4 w-4" /> Enable Distribution
                       </Button>
                    )}
                    <Button variant="outline" className="w-full justify-start text-blue-500 hover:text-blue-600 hover:bg-blue-500/10" disabled={isActionLoading} onClick={() => openActionModal('invalidate')}>
                       <RefreshCw className="mr-2 h-4 w-4" /> Invalidate Cache
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                       <Trash2 className="mr-2 h-4 w-4" /> Delete Distribution
                    </Button>
                 </>
              );
           })()}
           {(selectedNode.data.serviceId === 'azure_cdn' || selectedNode.data.serviceId === 'gcp_cdn') && (
              <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={isActionLoading || safetyCheck?.isDeletable === false} onClick={() => openActionModal('delete')}>
                 <Trash2 className="mr-2 h-4 w-4" /> Delete CDN
              </Button>
           )}
          {/* Fallback if no specific buttons */}
          {['ec2', 's3', 'dynamodb', 'rds', 'lambda', 'azure_vm', 'azure_storage', 'azure_sql', 'azure_function', 'azure_vnet', 'aws_vpc', 'gcp_vpc', 'vpc', 'gcp_compute', 'gcp_storage', 'gcp_sql', 'gcp_function', 'gcp_gke', 'eip', 'sg', 'tg', 'ecr', 'ecr_image', 'apigateway', 'cloudfront', 'azure_cdn', 'gcp_cdn'].indexOf(selectedNode.data.serviceId) === -1 && (
             <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border text-center">
                No automated actions configured for this service yet.
             </div>
          )}
           </>
         )}
      </div>
    </div>
  );
}
