import type { CredentialSelection } from "@/lib/aws-credential-vault";

export interface UseDeploymentStateProps {
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

export interface AccountInfo {
  accountId: string;
  arn: string;
}

export interface DeploymentCredentialFields {
  provider: "aws" | "azure" | "gcp";
  credentialSelection: CredentialSelection;
  formRegion: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  tenantId: string;
  subscriptionId: string;
  clientId: string;
  clientSecret: string;
  projectId: string;
  clientEmail: string;
  privateKey: string;
}
