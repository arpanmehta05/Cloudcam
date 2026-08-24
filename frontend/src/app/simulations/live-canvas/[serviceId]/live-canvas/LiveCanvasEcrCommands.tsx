import type { Node as FlowNode } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Check, Copy } from "@/icons";

type LiveCanvasEcrCommandsProps = {
  selectedNode: FlowNode<any>;
  region: string;
  copiedCmdIndex: number | null;
  handleCopyCmd: (cmd: string, idx: number) => void;
};

export function LiveCanvasEcrCommands({
  selectedNode,
  region,
  copiedCmdIndex,
  handleCopyCmd,
}: LiveCanvasEcrCommandsProps) {
  if (selectedNode.data.serviceId !== "ecr") return null;

  const repoName = selectedNode.data.config?.repositoryName || selectedNode.data.label;
  const repoUri = selectedNode.data.config?.repositoryUri || "";
  const repoRegion = selectedNode.data.item?.region || region;

  const loginCmd = `aws ecr get-login-password --region ${repoRegion} | docker login --username AWS --password-stdin ${repoUri.split("/")[0]}`;
  const buildCmd = `docker build -t ${repoName} .`;
  const tagCmd = `docker tag ${repoName}:latest ${repoUri}:latest`;
  const pushCmd = `docker push ${repoUri}:latest`;

  const commands = [
    { label: "1. Authenticate Docker", cmd: loginCmd },
    { label: "2. Build Image", cmd: buildCmd },
    { label: "3. Tag Image", cmd: tagCmd },
    { label: "4. Push to ECR", cmd: pushCmd }
  ];

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Push Commands</h3>
        <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5 uppercase">Docker CLI</Badge>
      </div>
      <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-3 text-xs">
        {commands.map((c, idx) => {
          const isCopied = copiedCmdIndex === idx;
          return (
            <div key={idx} className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{c.label}</span>
              <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-2 font-mono text-[9px] text-slate-100 pr-10">
                <span className="truncate select-all block mr-2">{c.cmd}</span>
                <button
                  onClick={() => handleCopyCmd(c.cmd, idx)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy to Clipboard"
                >
                  {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
