import type { Node as FlowNode } from "reactflow";
import { Check, Copy, ExternalLink, Terminal } from "@/icons";
import { findPublicIp } from "./liveCanvasHelpers";

type LiveCanvasAccessCardsProps = {
  selectedNode: FlowNode<any>;
  selectedProvider: string;
  region: string;
  sshUsername: string;
  setSshUsername: (value: string) => void;
  sshKeyName: string;
  setSshKeyName: (value: string) => void;
  httpCopied: boolean;
  handleCopyHttp: (url: string) => void;
  sshCopied: boolean;
  handleCopySsh: (cmd: string) => void;
};

export function LiveCanvasAccessCards({
  selectedNode,
  selectedProvider,
  region,
  sshUsername,
  setSshUsername,
  sshKeyName,
  setSshKeyName,
  httpCopied,
  handleCopyHttp,
  sshCopied,
  handleCopySsh,
}: LiveCanvasAccessCardsProps) {
  if (
    selectedNode.data.serviceId === "ec2" ||
    selectedNode.data.serviceId === "azure_vm" ||
    selectedNode.data.serviceId === "gcp_compute"
  ) {
    const publicIp = findPublicIp(selectedNode.data.item);
    if (!publicIp) return null;
    const httpUrl = `http://${publicIp}`;
    const sshCommand = `ssh -i "${sshKeyName}.pem" ${sshUsername}@${publicIp}`;
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access</h3>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">HTTP Endpoint</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Open the live VM over HTTP. For CloudWatcher-launched app hosts this should hit the nginx reverse proxy on port 80.
          </p>
          <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-[10px] text-slate-100 select-all break-all pr-20">
            <span>{httpUrl}</span>
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button
                onClick={() => handleCopyHttp(httpUrl)}
                className="rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy HTTP link"
              >
                {httpCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={httpUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Open HTTP link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold text-foreground">SSH Terminal Session</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            This live instance has a public IP address. Configure connection details below to generate the SSH command.
          </p>

          {/* SSH Username Input and Quick-Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Username
            </label>
            <input
              type="text"
              value={sshUsername}
              onChange={(e) => setSshUsername(e.target.value)}
              className="h-8 w-full rounded border border-border bg-background px-2 text-xs font-semibold text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              placeholder="e.g. ubuntu"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(selectedNode.data.serviceId === "ec2"
                ? ["ec2-user", "ubuntu", "admin", "root", "centos", "debian"]
                : selectedNode.data.serviceId === "azure_vm"
                ? ["azureuser", "ubuntu", "admin", "root"]
                : ["cloudwatcher", "ubuntu", "admin", "root"]
              ).map((usr) => (
                <button
                  key={usr}
                  type="button"
                  onClick={() => setSshUsername(usr)}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-all border ${
                    sshUsername === usr
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-black/10 border-border/30 text-muted-foreground hover:text-foreground hover:bg-black/20"
                  }`}
                >
                  {usr}
                </button>
              ))}
            </div>
          </div>

          {/* Private Key Name Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Key File Name (.pem)
            </label>
            <div className="flex items-center rounded border border-border bg-background px-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30">
              <input
                type="text"
                value={sshKeyName}
                onChange={(e) => setSshKeyName(e.target.value)}
                className="h-8 w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none"
                placeholder="e.g. my-key"
              />
              <span className="text-[10px] font-bold text-muted-foreground/60 select-none pr-1">.pem</span>
            </div>
          </div>

          {/* SSH Command Box */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Generated Command
            </label>
            <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-[10px] text-slate-100 select-all break-all pr-12">
              <span>{sshCommand}</span>
              <button
                onClick={() => handleCopySsh(sshCommand)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy to Clipboard"
              >
                {sshCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedNode.data.serviceId === "apigateway") {
    let gatewayUrl = "";
    if (selectedProvider === "aws") {
      const apiId = selectedNode.data.item?.id || selectedNode.id.replace("apigateway_", "");
      const apiRegion = selectedNode.data.item?.region || region;
      gatewayUrl = `https://${apiId}.execute-api.${apiRegion}.amazonaws.com/prod`;
    } else if (selectedProvider === "azure") {
      gatewayUrl = selectedNode.data.item?.gatewayUrl || "";
    } else if (selectedProvider === "gcp") {
      gatewayUrl = selectedNode.data.item?.gatewayUrl || "";
    }

    if (!gatewayUrl) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access</h3>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">API Gateway URL</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            The active endpoint URL for this API Gateway.
          </p>
          <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-[10px] text-slate-100 select-all break-all pr-20">
            <span>{gatewayUrl}</span>
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button
                onClick={() => handleCopyHttp(gatewayUrl)}
                className="rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy URL"
              >
                {httpCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={gatewayUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Open link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
