import type { CredentialSelection } from "@/lib/aws-credential-vault";
import { slugSimulationName } from "./scriptGenerators";

export function applyGcpServiceAccountPaste({
  value,
  setGcpJsonPaste,
  setProjectId,
  setClientEmail,
  setPrivateKey,
  setCredentialSelection,
}: {
  value: string;
  setGcpJsonPaste: (value: string) => void;
  setProjectId: (value: string) => void;
  setClientEmail: (value: string) => void;
  setPrivateKey: (value: string) => void;
  setCredentialSelection: (value: CredentialSelection) => void;
}) {
  setGcpJsonPaste(value);
  if (!value.trim()) return;
  try {
    const parsed = JSON.parse(value);
    if (parsed.project_id) setProjectId(parsed.project_id);
    if (parsed.client_email) setClientEmail(parsed.client_email);
    if (parsed.private_key) setPrivateKey(parsed.private_key);
    setCredentialSelection({ mode: "manual" });
  } catch {
    // Handled inline
  }
}

export function copyDeploymentLogs({
  logs,
  setCopied,
}: {
  logs: string[];
  setCopied: (value: boolean) => void;
}) {
  navigator.clipboard.writeText(logs.join("\n"));
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

export function resolveDeploymentSshKeyName({
  vmInfo,
  outputs,
  provider,
  deploymentId,
  name,
}: {
  vmInfo: any;
  outputs: Record<string, any>;
  provider: "aws" | "azure" | "gcp";
  deploymentId: string | null;
  name: string;
}) {
  const outputKeyName =
    typeof outputs.key_name?.value === "string"
      ? outputs.key_name.value
      : typeof outputs.key_name === "string"
        ? outputs.key_name
        : "";
  const vmKeyName = typeof vmInfo?.key_name === "string" ? vmInfo.key_name : "";

  if (vmKeyName && !(provider !== "aws" && vmKeyName === "simulation")) {
    return vmKeyName;
  }
  if (outputKeyName) return outputKeyName;

  const shortId = deploymentId ? `-${deploymentId.substring(0, 8)}` : "";
  return `${slugSimulationName(name)}${shortId}-key`;
}
