"use client";

import { Shield, Check } from "@/icons";
import { AwsCredentialVaultPicker } from "@/components/AwsCredentialVaultPicker";
import type { CredentialSelection } from "@/lib/aws-credential-vault";

interface CredentialSelectionSectionProps {
  provider: "aws" | "azure" | "gcp";
  phase: string;
  formRegion: string;
  credentialSelection: CredentialSelection;
  onCredentialSelectionChange: (selection: CredentialSelection) => void;
  accessKeyId: string;
  setAccessKeyId: (val: string) => void;
  secretAccessKey: string;
  setSecretAccessKey: (val: string) => void;
  sessionToken: string;
  setSessionToken: (val: string) => void;
  tenantId: string;
  setTenantId: (val: string) => void;
  subscriptionId: string;
  setSubscriptionId: (val: string) => void;
  clientId: string;
  setClientId: (val: string) => void;
  clientSecret: string;
  setClientSecret: (val: string) => void;
  projectId: string;
  setProjectId: (val: string) => void;
  clientEmail: string;
  setClientEmail: (val: string) => void;
  privateKey: string;
  setPrivateKey: (val: string) => void;
  gcpJsonPaste: string;
  setGcpJsonPaste: (val: string) => void;
  showAdvancedGcp: boolean;
  setShowAdvancedGcp: (val: boolean) => void;
  handleGcpJsonPaste: (value: string) => void;
  isGcpKeyConfigured: boolean;
}

export function CredentialSelectionSection({
  provider,
  phase,
  formRegion,
  credentialSelection,
  onCredentialSelectionChange,
  accessKeyId,
  setAccessKeyId,
  secretAccessKey,
  setSecretAccessKey,
  sessionToken,
  setSessionToken,
  tenantId,
  setTenantId,
  subscriptionId,
  setSubscriptionId,
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
  projectId,
  setProjectId,
  clientEmail,
  setClientEmail,
  privateKey,
  setPrivateKey,
  gcpJsonPaste,
  showAdvancedGcp,
  setShowAdvancedGcp,
  handleGcpJsonPaste,
  isGcpKeyConfigured,
}: CredentialSelectionSectionProps) {
  const providerLabel =
    provider === "azure" ? "Azure" : provider === "gcp" ? "GCP" : "AWS";

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Shield className="h-4 w-4 text-primary" />
        <span>Authorize Deployment Session</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {provider === "azure"
          ? "Use your saved cloud integration principal keys, or configure a temporary service principal to provision resources."
          : provider === "gcp"
            ? "Paste a GCP service account JSON key or select the saved global connection to grant access to the deployment runner."
            : "Paste temporary AWS STS credentials or select a pre-authenticated profile from your vault."}
      </p>

      {provider === "aws" && (
        <AwsCredentialVaultPicker
          region={formRegion}
          accessKeyId={accessKeyId}
          secretAccessKey={secretAccessKey}
          sessionToken={sessionToken}
          disabled={phase !== "creds"}
          selection={credentialSelection}
          onSelectionChange={onCredentialSelectionChange}
        />
      )}

      {(provider === "azure" || provider === "gcp") && (
        <div className="flex rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() =>
              onCredentialSelectionChange({
                mode: "saved",
                credentialVaultId: "saved",
                userPresenceVerified: true,
              })
            }
            className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold transition-all ${credentialSelection.mode === "saved" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Saved Connection
          </button>
          <button
            type="button"
            onClick={() =>
              onCredentialSelectionChange({ mode: "manual" })
            }
            className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold transition-all ${credentialSelection.mode === "manual" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Manual Keys
          </button>
        </div>
      )}

      <div className="space-y-4 select-text">
        {credentialSelection.mode === "saved" &&
        (provider === "azure" || provider === "gcp") ? (
          <div className="rounded-xl border border-border bg-muted/20 p-5 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Using Saved Profile
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                Connecting with the global {providerLabel}{" "}
                integrations configured under settings dashboard.
              </p>
            </div>
          </div>
        ) : provider === "gcp" ? (
          <>
            {isGcpKeyConfigured ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-2 relative">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-600">
                    JSON Key Loaded
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-1 font-mono">
                  <p>
                    <strong className="text-foreground">
                      Project:
                    </strong>{" "}
                    {projectId}
                  </p>
                  <p>
                    <strong className="text-foreground">
                      Client Email:
                    </strong>{" "}
                    {clientEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleGcpJsonPaste("");
                    setProjectId("");
                    setClientEmail("");
                    setPrivateKey("");
                  }}
                  className="absolute top-4 right-4 text-[10px] text-red-500 font-semibold hover:underline"
                >
                  Clear Key
                </button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="gcpJsonPaste"
                  className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Service Account JSON Key
                </label>
                <textarea
                  id="gcpJsonPaste"
                  name="gcpJsonPaste"
                  value={gcpJsonPaste}
                  onChange={(e) =>
                    handleGcpJsonPaste(e.target.value)
                  }
                  placeholder="Paste the full GCP IAM Service Account JSON key here..."
                  className="h-24 w-full rounded-lg border border-border/80 bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            <div className="border-t border-border/50 pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedGcp(!showAdvancedGcp)}
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                {showAdvancedGcp
                  ? "Hide raw parameter details"
                  : "Show raw parameter details"}
              </button>

              {showAdvancedGcp && (
                <div className="space-y-3 mt-3">
                  <div>
                    <label
                      htmlFor="projectId"
                      className="mb-1 block text-[9px] font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      Project ID
                    </label>
                    <input
                      id="projectId"
                      name="projectId"
                      type="text"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      placeholder="my-gcp-project-123"
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="clientEmail"
                      className="mb-1 block text-[9px] font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      Client Email
                    </label>
                    <input
                      id="clientEmail"
                      name="clientEmail"
                      type="text"
                      value={clientEmail}
                      onChange={(e) =>
                        setClientEmail(e.target.value)
                      }
                      placeholder="service-account@project.iam.gserviceaccount.com"
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="privateKey"
                      className="mb-1 block text-[9px] font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      Private Key
                    </label>
                    <textarea
                      id="privateKey"
                      name="privateKey"
                      value={privateKey}
                      onChange={(e) =>
                        setPrivateKey(e.target.value)
                      }
                      placeholder="-----BEGIN PRIVATE KEY-----"
                      className="h-20 w-full rounded-lg border border-border/80 bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : provider === "azure" ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="tenantId"
                className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                Tenant ID
              </label>
              <input
                id="tenantId"
                name="tenantId"
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="subscriptionId"
                className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                Subscription ID
              </label>
              <input
                id="subscriptionId"
                name="subscriptionId"
                type="text"
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="clientId"
                className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                Client ID (Application ID)
              </label>
              <input
                id="clientId"
                name="clientId"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="clientSecret"
                className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                Client Secret
              </label>
              <input
                id="clientSecret"
                name="clientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="••••••••••••••••••••"
                className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="accessKeyId"
                className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                Access Key ID
              </label>
              <input
                id="accessKeyId"
                name="accessKeyId"
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="AKIA..."
                className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="secretAccessKey"
                className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                Secret Access Key
              </label>
              <input
                id="secretAccessKey"
                name="secretAccessKey"
                type="password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="••••••••••••••••••••"
                className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="sessionToken"
                className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                Session Token (Optional)
              </label>
              <input
                id="sessionToken"
                name="sessionToken"
                type="text"
                value={sessionToken}
                onChange={(e) => setSessionToken(e.target.value)}
                placeholder="STS Session Token for temporary profiles"
                className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Region Target
          </label>
          <input
            type="text"
            value={formRegion}
            readOnly
            disabled
            className="h-10 w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}
