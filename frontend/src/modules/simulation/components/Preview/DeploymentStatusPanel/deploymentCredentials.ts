import type { DeploymentCredentialFields } from "./deploymentStateTypes";

export function buildCredentialPayload({
  provider,
  credentialSelection,
  formRegion,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  tenantId,
  subscriptionId,
  clientId,
  clientSecret,
  projectId,
  clientEmail,
  privateKey,
}: DeploymentCredentialFields) {
  if (
    credentialSelection.mode === "saved" &&
    credentialSelection.credentialVaultId
  ) {
    return {
      provider,
      credentialVaultId: credentialSelection.credentialVaultId,
      userPresenceVerified: credentialSelection.userPresenceVerified === true,
      region: formRegion,
    };
  }

  if (provider === "gcp") {
    return { provider, projectId, clientEmail, privateKey, region: formRegion };
  }

  if (provider === "azure") {
    return {
      provider,
      tenantId,
      subscriptionId,
      clientId,
      clientSecret,
      region: formRegion,
    };
  }

  return { provider, accessKeyId, secretAccessKey, sessionToken, region: formRegion };
}

export function canValidateDeploymentCredentials({
  provider,
  credentialSelection,
  accessKeyId,
  secretAccessKey,
  tenantId,
  subscriptionId,
  clientId,
  clientSecret,
  projectId,
  clientEmail,
  privateKey,
}: DeploymentCredentialFields) {
  if (credentialSelection.mode === "saved") {
    return (
      !!credentialSelection.credentialVaultId &&
      credentialSelection.userPresenceVerified === true
    );
  }

  if (provider === "gcp") return !!(projectId && clientEmail && privateKey);
  if (provider === "azure") {
    return !!tenantId && !!subscriptionId && !!clientId && !!clientSecret;
  }
  return !!accessKeyId && !!secretAccessKey;
}
