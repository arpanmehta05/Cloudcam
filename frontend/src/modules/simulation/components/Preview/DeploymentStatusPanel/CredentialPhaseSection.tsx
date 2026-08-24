"use client";

import { AlertCircle, Shield } from "@/icons";
import { CredentialSelectionSection } from "./CredentialSelectionSection";

interface CredentialPhaseSectionProps {
  provider: "aws" | "azure" | "gcp";
  state: any;
}

function CredentialSetupGuidelines({
  provider,
}: {
  provider: "aws" | "azure" | "gcp";
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-2 shrink-0">
      <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">
        Setup Guidelines:
      </p>
      {provider === "gcp" ? (
        <ol className="text-[10px] text-muted-foreground leading-normal list-decimal list-inside space-y-1">
          <li>Generate service account keys on Google Cloud IAM Dashboard.</li>
          <li>Assign Project Viewer, Compute, Storage, and SQL Admin permissions.</li>
          <li>Download the JSON credentials payload and paste it directly above.</li>
        </ol>
      ) : provider === "azure" ? (
        <ol className="text-[10px] text-muted-foreground leading-normal list-decimal list-inside space-y-1">
          <li>
            Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">
              az ad sp create-for-rbac --name "CloudWatcher" --role Contributor
            </code>
          </li>
          <li>Use the client details returned to authorize your credentials.</li>
        </ol>
      ) : (
        <ol className="text-[10px] text-muted-foreground leading-normal list-decimal list-inside space-y-1">
          <li>Retrieve AWS CLI Access Key ID and Secret Access Key from IAM console.</li>
          <li>If using temporary credentials, copy the active Session Token.</li>
        </ol>
      )}
    </div>
  );
}

export function CredentialPhaseSection({
  provider,
  state,
}: CredentialPhaseSectionProps) {
  return (
    <div className="space-y-4">
      <CredentialSelectionSection
        provider={provider}
        phase={state.phase}
        formRegion={state.formRegion}
        credentialSelection={state.credentialSelection}
        onCredentialSelectionChange={state.setCredentialSelection}
        accessKeyId={state.accessKeyId}
        setAccessKeyId={state.setAccessKeyId}
        secretAccessKey={state.secretAccessKey}
        setSecretAccessKey={state.setSecretAccessKey}
        sessionToken={state.sessionToken}
        setSessionToken={state.setSessionToken}
        tenantId={state.tenantId}
        setTenantId={state.setTenantId}
        subscriptionId={state.subscriptionId}
        setSubscriptionId={state.setSubscriptionId}
        clientId={state.clientId}
        setClientId={state.setClientId}
        clientSecret={state.clientSecret}
        setClientSecret={state.setClientSecret}
        projectId={state.projectId}
        setProjectId={state.setProjectId}
        clientEmail={state.clientEmail}
        setClientEmail={state.setClientEmail}
        privateKey={state.privateKey}
        setPrivateKey={state.setPrivateKey}
        gcpJsonPaste={state.gcpJsonPaste}
        setGcpJsonPaste={state.setGcpJsonPaste}
        showAdvancedGcp={state.showAdvancedGcp}
        setShowAdvancedGcp={state.setShowAdvancedGcp}
        handleGcpJsonPaste={state.handleGcpJsonPaste}
        isGcpKeyConfigured={state.isGcpKeyConfigured}
      />

      <button
        onClick={state.handleValidateCreds}
        disabled={!state.canValidateCredentials}
        className="simulation-action mt-2 w-full border-primary/30 bg-primary text-white disabled:cursor-not-allowed disabled:opacity-50 py-3"
      >
        <Shield className="h-3.5 w-3.5 mr-2" />
        Verify & Authenticate Account
      </button>

      {state.error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 flex gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-500 font-semibold select-text">
            {state.error}
          </div>
        </div>
      )}

      <CredentialSetupGuidelines provider={provider} />
    </div>
  );
}
