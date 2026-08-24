"use client";

import { AlertCircle, Key, Download, ExternalLink, Copy, Check, Server, Lightbulb, Terminal } from "@/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SshCommandBlock } from "./SshCommandBlock";
import { ApplicationLinkBlock } from "./ApplicationLinkBlock";

interface OutputsPanelProps {
  phase: string;
  error: string | null;
  logs: string[];
  mode: "simulation" | "live-action";
  outputs: Record<string, any>;
  provider: "aws" | "azure" | "gcp";
  formRegion: string;
  action: string;
  resourceLabel: string;
  service?: string;
  deploymentId: string | null;
  name: string;
  handleDownloadPem: () => void;
  handleCopyUrl: (url: string, key: string) => void;
  copiedUrls: Record<string, boolean>;
  resolveSshKeyName: (vmInfo: any) => string;
  onRestartConnection: () => void;
}

function getErrorDiagnostic(error: string | null, logs: string[]) {
  const allText = ((error || "") + "\n" + logs.join("\n")).trim();
  const lower = allText.toLowerCase();

  if (lower.includes("must match regex") && lower.includes("name")) {
    const match = allText.match(
      /"name" \("([^"]+)"\) must match regex "([^"]+)"/,
    );
    const invalidName = match ? match[1] : "invalid name";
    const regexPattern = match ? match[2] : "^[a-z]([-a-z0-9]*[a-z0-9])?$";
    return {
      title: "GCP Resource Naming Violation",
      reason: `The resource name "${invalidName}" does not match GCP's strict naming pattern regex "${regexPattern}".`,
      solution:
        "GCP resource names must be all lowercase, start with a lowercase letter, end with a letter or number, and only contain lowercase letters, numbers, and hyphens. Click 'Try Again', open the resource panel on the canvas, and rename the resource to meet these criteria.",
    };
  }

  if (
    lower.includes("publicipcountlimitreached") ||
    (lower.includes("cannot create more than") && lower.includes("public ip"))
  ) {
    return {
      title: "Azure Public IP Limit Reached",
      reason:
        "Azure rejected the VM because this subscription has reached the public IP address limit for the selected region.",
      solution:
        "Destroy older active or failed simulation deployments that still own public IPs, delete unused public IP resources in Azure Portal, or request a quota increase for public IP addresses in that region. Then redeploy the simulation.",
    };
  }

  if (
    lower.includes(
      "to be managed via terraform this resource needs to be imported into the state",
    ) ||
    lower.includes("already exists - to be managed via terraform")
  ) {
    return {
      title: "Azure Resources Already Exist",
      reason:
        "Terraform found Azure resources with the same generated names, but they are not in the current deployment state. This usually happens after an earlier partial deployment created resources before failing.",
      solution:
        "Destroy the older failed deployment from Simulation History if it has a destroy option, or remove the leaked VNet, NSG, NIC, public IP, and VM resources from the Azure resource group before retrying. Starting a fresh deployment can avoid name reuse, but leaked resources should still be cleaned up.",
    };
  }

  if (
    lower.includes(
      "static ip allocation must be used when creating standard sku public ip addresses",
    )
  ) {
    return {
      title: "Azure Public IP Configuration Error",
      reason:
        "Azure Standard SKU public IP addresses must use static allocation.",
      solution:
        "This has been fixed in the Terraform generator. Redeploy with the updated backend so Azure public IPs are created with Static allocation.",
    };
  }

  if (
    lower.includes("bucketalreadyexists") ||
    lower.includes("bucket name is already in use")
  ) {
    return {
      title: "Global Bucket Name Collision",
      reason:
        "The requested Cloud Storage/S3 bucket name is already taken globally by another cloud user.",
      solution:
        "Bucket names must be globally unique across all users. Close this panel, edit your Storage Bucket configuration on the canvas, and use a more unique bucket name (e.g., append a unique suffix or your initials).",
    };
  }

  if (
    lower.includes("invalidclienttokenid") ||
    lower.includes("signaturedoesnotmatch") ||
    lower.includes("expiredtoken")
  ) {
    return {
      title: "AWS Authentication Failure",
      reason: "The AWS credentials provided are invalid or have expired.",
      solution:
        "Please check your Access Key ID and Secret Access Key. If you are using temporary credentials (e.g., from AWS Academy or AWS SSO), make sure to copy and paste the updated Session Token as well.",
    };
  }

  if (
    lower.includes("invalid_grant") ||
    lower.includes("credentials could not be loaded") ||
    lower.includes("authentication failed")
  ) {
    return {
      title: "GCP Authentication Failure",
      reason:
        "The GCP service account credentials could not be authenticated, or the project ID is incorrect.",
      solution:
        "Please double-check the pasted service account JSON key. Ensure the credentials are for the correct project and the key has not been revoked.",
    };
  }

  if (
    lower.includes("invalidclientsecret") ||
    lower.includes("aadsts7000215") ||
    lower.includes("unauthorized_client")
  ) {
    return {
      title: "Azure Authentication Failure",
      reason: "The Azure Client Secret or Application ID is incorrect.",
      solution:
        "Please double-check your Client Secret and Application (Client) ID. Make sure the Service Principal exists and the secret is active in the Microsoft Entra ID portal.",
    };
  }

  if (
    lower.includes("authorizationfailed") ||
    lower.includes("does not have authorization") ||
    lower.includes("permissiondenied")
  ) {
    return {
      title: "Insufficient Cloud Permissions",
      reason:
        "The cloud credentials authenticated successfully but do not have enough permissions to create one or more resources.",
      solution:
        "Ensure that your Service Principal / Service Account / AWS IAM User has the required Admin or Contributor role. In AWS, attach the AdministratorAccess policy. In GCP, grant Project Editor/Owner. In Azure, grant Owner or Contributor at the Subscription scope.",
    };
  }

  if (
    lower.includes("invalid cidr") ||
    lower.includes("invalidcidr") ||
    lower.includes("address space")
  ) {
    return {
      title: "Invalid Networking Configuration",
      reason:
        "A subnet CIDR range or VPC/VNet address space is malformed or overlapping.",
      solution:
        "Double check your VPC/VNet address space configuration (e.g., 10.0.0.0/16) and confirm any subnets lie within that range.",
    };
  }

  if (
    lower.includes(
      "scope of the specified subnetwork doesn't match the scope of the instance",
    )
  ) {
    return {
      title: "Scope & Region Mismatch",
      reason:
        "The Compute Engine VM instance is configured in a different zone than the VPC subnetwork region it is attached to.",
      solution:
        "Configure the Compute Engine VM Zone to belong to the deployment region. Ensure the subnet and VM are in the same region (e.g. a subnet in asia-south1 can only connect to instances in asia-south1-a/b/c).",
    };
  }

  return {
    title: "Deployment Execution Failed",
    reason:
      error ||
      "Terraform runner encountered an error while executing HCL scripts.",
    solution:
      "Please examine the detailed console terminal logs below to diagnose the exact issue. Ensure your cloud account is active and has no billing locks.",
  };
}

export function OutputsPanel({
  phase,
  error,
  logs,
  mode,
  outputs,
  provider,
  formRegion,
  handleDownloadPem,
  handleCopyUrl,
  copiedUrls,
  resolveSshKeyName,
  onRestartConnection,
}: OutputsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Intelligent Diagnostic Block (Only if failed) */}
      {phase === "failed" && (
        (() => {
          const diag = getErrorDiagnostic(error, logs);
          return (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  {diag.title}
                </h4>
              </div>
              <div className="text-[11px] leading-relaxed text-muted-foreground space-y-2.5 select-text">
                <p>
                  <strong>Detailed Reason:</strong> {diag.reason}
                </p>
                <div className="text-foreground font-semibold bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-rose-600 font-extrabold block uppercase tracking-wider mb-0.5">
                      Recommended Actions:
                    </span>
                    <span className="font-semibold text-foreground text-[10px] leading-normal block">
                      {diag.solution}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Access Key PEM download */}
      {mode === "simulation" && outputs.private_key?.value && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left space-y-2">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold text-foreground">
              PEM Key Ready
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Private PEM key has been generated for VM instances.
            Download this key now to connect over SSH.
          </p>
          <Button
            onClick={handleDownloadPem}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 mt-1"
          >
            <Download className="h-4 w-4" />
            Download PEM Private Key
          </Button>
        </div>
      )}

      {/* Load Balancer / EKS Application Links */}
      {mode === "simulation" &&
        Object.keys(outputs)
          .filter((key) => key.startsWith("lb_info_"))
          .map((key) => {
            const lbInfo = outputs[key]?.value || outputs[key];
            if (!lbInfo || !lbInfo.url) return null;
            const cleanNodeId = key
              .replace("lb_info_sim_", "")
              .toUpperCase();
            return (
              <ApplicationLinkBlock
                key={`lb-${key}`}
                label={`${lbInfo.name || "Load Balancer"} Link for ${cleanNodeId}`}
                url={lbInfo.url}
                proxy="load-balancer"
              />
            );
          })}

      {/* CDN / CloudFront Links */}
      {mode === "simulation" &&
        Object.keys(outputs)
          .filter((key) => key.startsWith("cdn_domain_"))
          .map((key) => {
            const cdnUrlVal = outputs[key]?.value || outputs[key];
            if (!cdnUrlVal) return null;
            const cleanNodeId = key
              .replace("cdn_domain_sim_", "")
              .toUpperCase();
            const isCopied = !!copiedUrls[key];
            const formattedUrl = cdnUrlVal.startsWith("http") ? cdnUrlVal : `https://${cdnUrlVal}`;
            return (
              <div key={key} className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-left space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ExternalLink className="h-4 w-4 text-purple-500 shrink-0" />
                    <span className="truncate text-xs font-bold text-foreground">
                      CDN Domain Link ({cleanNodeId})
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-purple-500/20 bg-purple-500/10 text-[9px] text-purple-600 uppercase"
                  >
                    {provider === "aws" ? "CloudFront" : provider === "azure" ? "Azure CDN" : "GCP CDN"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Your CDN content delivery network distribution is live. Access your website or API using the URL below:
                </p>
                <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-[10px] text-slate-100 select-all break-all pr-12 font-semibold">
                  <span>{formattedUrl}</span>
                  <button
                    onClick={() => handleCopyUrl(formattedUrl, key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy URL"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-purple-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

      {/* API Gateway Links */}
      {mode === "simulation" &&
        Object.keys(outputs)
          .filter((key) => key.startsWith("apigateway_url_"))
          .map((key) => {
            const gwUrlVal = outputs[key]?.value || outputs[key];
            if (!gwUrlVal) return null;
            const cleanNodeId = key
              .replace("apigateway_url_sim_", "")
              .toUpperCase();
            const isCopied = !!copiedUrls[key];
            return (
              <div key={key} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-left space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ExternalLink className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="truncate text-xs font-bold text-foreground">
                      API Gateway Endpoint ({cleanNodeId})
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-emerald-500/20 bg-emerald-500/10 text-[9px] text-emerald-600 uppercase"
                  >
                    {provider === "aws" ? "API Gateway" : provider === "azure" ? "APIM" : "API Gateway"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Your serverless endpoint is live. Use the URL below to invoke the function directly:
                </p>
                <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-[10px] text-slate-100 select-all break-all pr-12">
                  <span>{gwUrlVal}</span>
                  <button
                    onClick={() => handleCopyUrl(gwUrlVal, key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy URL"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

      {/* Application Link Blocks */}
      {mode === "simulation" &&
        Object.keys(outputs)
          .filter((key) => key.startsWith("vm_info_"))
          .map((key) => {
            const vmInfo = outputs[key]?.value || outputs[key];
            if (!vmInfo?.application_url) return null;
            const cleanNodeId = key
              .replace("vm_info_sim_", "")
              .toUpperCase();
            return (
              <ApplicationLinkBlock
                key={`app-${key}`}
                label={`Application Link for ${cleanNodeId}`}
                url={vmInfo.application_url}
                port={vmInfo.application_port}
                containerPort={vmInfo.container_port}
                proxy={vmInfo.reverse_proxy || "nginx"}
                healthCommand={vmInfo.health_probe_command}
                healthLogPath={vmInfo.health_log_path}
              />
            );
          })}

      {/* SSH Command Blocks */}
      {mode === "simulation" &&
        Object.keys(outputs)
          .filter((key) => key.startsWith("vm_info_"))
          .map((key) => {
            const vmInfo = outputs[key]?.value || outputs[key];
            if (!vmInfo?.public_ip) return null;
            const cleanNodeId = key
              .replace("vm_info_sim_", "")
              .toUpperCase();
            return (
              <SshCommandBlock
                key={key}
                label={`SSH Connect Command for ${cleanNodeId}`}
                ip={vmInfo.public_ip}
                defaultUsername={vmInfo.username || "admin"}
                defaultKeyName={resolveSshKeyName(vmInfo)}
                provider={provider}
              />
            );
          })}

      {/* ECR Registry and Push Instructions */}
      {Object.keys(outputs)
        .filter((key) => key.startsWith("ecr_url_"))
        .map((key) => {
          const ecrUrlVal = outputs[key]?.value || outputs[key];
          if (!ecrUrlVal) return null;

          const cleanNodeId = key
            .replace("ecr_url_sim_", "")
            .replace("ecr_url_", "")
            .toUpperCase();

          const pushInstKey = key.replace("ecr_url_", "") + "_push_instructions";
          const pushInstVal = outputs[pushInstKey]?.value || outputs[pushInstKey];

          const isEcrCopied = !!copiedUrls[key];
          const isPushCopied = !!copiedUrls[pushInstKey];

          const registryLabel =
            provider === "azure"
              ? "Azure ACR"
              : provider === "gcp"
                ? "GCP Artifact Registry"
                : "AWS ECR";

          const registryFullName =
            provider === "azure"
              ? "Azure Container Registry"
              : provider === "gcp"
                ? "GCP Artifact Registry"
                : "ECR Registry";

          return (
            <div key={key} className="space-y-4">
              {/* ECR Repo URL block */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Server className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="truncate text-xs font-bold text-foreground">
                      {registryFullName} Repository URL ({cleanNodeId})
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-blue-500/20 bg-blue-500/10 text-[9px] text-blue-600 uppercase"
                  >
                    {registryLabel}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Your container registry repository is ready. Push your Docker image to the repository URL below:
                </p>
                <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-[10px] text-slate-100 select-all break-all pr-12 font-semibold">
                  <span>{ecrUrlVal}</span>
                  <button
                    onClick={() => handleCopyUrl(ecrUrlVal, key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copy Repository URL"
                  >
                    {isEcrCopied ? (
                      <Check className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* ECR Push Commands block */}
              {pushInstVal && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left space-y-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-bold text-foreground">
                      Registry Push Commands
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Execute the following commands in your local terminal to build and push your container image:
                  </p>
                  <div className="space-y-2.5">
                    {pushInstVal.split("&&").map((cmd: string, idx: number) => {
                      const trimmedCmd = cmd.trim();
                      const cmdKey = `${pushInstKey}_cmd_${idx}`;
                      const isCopied = !!copiedUrls[cmdKey];
                      return (
                        <div key={idx} className="space-y-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Step {idx + 1}
                          </span>
                          <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-[10px] text-slate-100 select-all break-all pr-12 font-semibold">
                            <span>{trimmedCmd}</span>
                            <button
                              onClick={() => handleCopyUrl(trimmedCmd, cmdKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={`Copy Step ${idx + 1}`}
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {/* Empty State */}
      {(!outputs || Object.keys(outputs).length === 0) && phase !== "failed" && (
        <div className="rounded-xl border border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
          <Server className="h-8 w-8 mx-auto mb-2 text-muted-foreground/45" />
          <span>Outputs will appear here once provisioning completes.</span>
        </div>
      )}

      {/* Restart connection form button if failed */}
      {phase === "failed" && (
        <button
          onClick={onRestartConnection}
          className="simulation-action simulation-action-primary w-full py-3 mt-2 text-xs"
        >
          Restart Connection Form
        </button>
      )}
    </div>
  );
}
