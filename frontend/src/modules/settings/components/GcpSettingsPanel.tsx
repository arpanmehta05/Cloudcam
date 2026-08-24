"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CloudIcon,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  LayoutList,
  ExternalLink,
  AlertCircle,
  Terminal,
  Code,
  Settings,
  Key,
  Copy,
  Check
} from "@/icons";
import { DashboardHeader } from "@/components/DashboardHeader";
import { cn } from "@/lib/utils";
import { useGcpSettings } from "../hooks/useCloudSettings";
import { ProviderConnectionTabs } from "./ProviderConnectionTabs";

const BRAND_NAME = "CloudWatcher";

const STEPS = [
  {
    title: "Setup Configuration",
    description: "Choose modules and monitoring options.",
    icon: LayoutList,
  },
  {
    title: "Provision Credentials",
    description: "Deploy via Cloud Shell, Terraform, or manual entry.",
    icon: Key,
  },
  {
    title: "Verify Connection",
    description: "Confirm connection with your Google Cloud project.",
    icon: ShieldCheck,
  }
];

export function GcpSettingsPanel() {
  const {
    isGcpConnected,
    connectionMeta,
    currentStep,
    isLoading,
    isPolling,
    error,
    checkingConnection,
    isDisconnecting,
    modules,
    setupDetails,
    provisionMethod,
    copiedCli,
    copiedTf,
    manualProjectId,
    manualClientEmail,
    manualPrivateKey,
    manualBillingDatasetId,
    manualBillingTableId,
    jsonPaste,
    manualSaving,
    manualError,
    isEditingBilling,
    billingDatasetInput,
    billingTableInput,
    savingBilling,
    billingError,
    setProvisionMethod,
    setManualProjectId,
    setManualClientEmail,
    setManualPrivateKey,
    setManualBillingDatasetId,
    setManualBillingTableId,
    setIsEditingBilling,
    setBillingDatasetInput,
    setBillingTableInput,
    toggleModule,
    handleGenerateSetup,
    handleJsonPasteChange,
    handleSaveManual,
    handleUpdateBilling,
    handleDisconnect,
    copyToClipboard,
    refreshConnectionStatus,
    setBillingError,
    setCurrentStep,
  } = useGcpSettings();

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <DashboardHeader
        timeRange="24h"
        onTimeRangeChange={() => { }}
        onRefresh={refreshConnectionStatus}
        isLoading={checkingConnection}
        lastUpdated=""
        showRegionSelector={false}
        showTimeRange={false}
        showAutoRefresh={false}
      />

      <div className="px-4 space-y-8">
        <ProviderConnectionTabs activeProvider="gcp" />

        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">
            Connect your Google Cloud Infrastructure
          </h1>
          <p className="text-neutral-500 text-lg max-w-2xl">
            {BRAND_NAME} integrates seamlessly with GCP using Service Accounts to monitor resource metrics, trace Serverless execution, and optimize usage bills.
          </p>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-3 gap-4">
          {STEPS.map((step, idx) => (
            <div key={step.title} className="relative">
              <div className={cn(
                "flex flex-col p-4 rounded-xl border transition-all duration-300 bg-white shadow-sm",
                currentStep === idx ? "border-blue-500 ring-1 ring-blue-500/10 shadow-md" :
                  currentStep > idx ? "border-green-100 bg-green-50/20" : "border-neutral-200"
              )}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    currentStep === idx ? "bg-blue-600 text-white" :
                      currentStep > idx ? "bg-green-600 text-white" : "bg-neutral-100 text-neutral-400"
                  )}>
                    {currentStep > idx ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-neutral-800">
                    Step {idx + 1}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-neutral-900">{step.title}</h3>
                <p className="text-xs text-neutral-400 mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Integration Details card when Connected */}
        {isGcpConnected && currentStep === 2 ? (
          <Card className="border-green-200 bg-green-50/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    GCP Project Connected Successfully
                  </CardTitle>
                  <CardDescription>
                    Your Google Cloud project is actively connected to {BRAND_NAME}.
                  </CardDescription>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                  Active Connection
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingBilling ? (
                <div className="space-y-4 border border-blue-100 bg-blue-50/5 p-4 rounded-xl">
                  <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Configure BigQuery Billing Export</h4>
                  {billingError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                      {billingError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="editBillingDatasetId" className="text-xs text-neutral-600 font-semibold">
                        Billing Export Dataset ID
                      </Label>
                      <Input
                        id="editBillingDatasetId"
                        value={billingDatasetInput}
                        onChange={e => setBillingDatasetInput(e.target.value)}
                        placeholder="e.g. gcp_billing"
                        className="text-xs bg-white text-neutral-900 border-neutral-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="editBillingTableId" className="text-xs text-neutral-600 font-semibold">
                        Billing Export Table ID
                      </Label>
                      <Input
                        id="editBillingTableId"
                        value={billingTableInput}
                        onChange={e => setBillingTableInput(e.target.value)}
                        placeholder="e.g. gcp_billing_export_v1_XXXXXX"
                        className="text-xs bg-white text-neutral-900 border-neutral-200"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingBilling(false);
                        setBillingDatasetInput(connectionMeta.billingDatasetId || "");
                        setBillingTableInput(connectionMeta.billingTableId || "");
                        setBillingError(null);
                      }}
                      disabled={savingBilling}
                      className="text-xs h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdateBilling}
                      disabled={savingBilling}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 font-semibold shadow-sm"
                    >
                      {savingBilling ? "Saving..." : "Save Billing Settings"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm bg-white p-4 border border-neutral-100 rounded-xl">
                  <div>
                    <span className="text-neutral-400 block text-xs">GCP Project ID</span>
                    <span className="font-mono text-neutral-800 break-all">{connectionMeta.projectId || "Unavailable"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-xs">Service Account Client Email</span>
                    <span className="font-mono text-neutral-800 break-all">{connectionMeta.clientEmail || "Unavailable"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-xs font-semibold">Billing Export Dataset ID</span>
                    <span className="font-mono text-neutral-800 break-all">{connectionMeta.billingDatasetId || "Not configured (billing setup required)"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-xs font-semibold">Billing Export Table ID</span>
                    <span className="font-mono text-neutral-800 break-all">{connectionMeta.billingTableId || "Not configured (billing setup required)"}</span>
                  </div>
                  <div className="mt-2 col-span-2 border-t pt-2 flex justify-between items-center">
                    <div>
                      <span className="text-neutral-400 block text-xs">Connected At</span>
                      <span className="text-neutral-800 text-xs">
                        {connectionMeta.connectedAt ? new Date(connectionMeta.connectedAt).toLocaleString() : "Just now"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsEditingBilling(true)}
                      className="h-8 text-xs flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Configure Billing
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting || isEditingBilling}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  {isDisconnecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Disconnecting...</> : "Disconnect Project"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Step Wizard rendering */
          <div className="space-y-6">
            {currentStep === 0 && (
              <Card className="border-neutral-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle>Select Cloud Observability Modules</CardTitle>
                  <CardDescription>
                    Configure which services {BRAND_NAME} should scan and optimize within your GCP project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {modules.map(mod => (
                      <div
                        key={mod.id}
                        onClick={() => !mod.disabled && toggleModule(mod.id)}
                        className={cn(
                          "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                          mod.checked ? "border-blue-200 bg-blue-50/10 shadow-sm" : "border-neutral-100 hover:bg-neutral-50",
                          mod.disabled && "opacity-75 cursor-not-allowed bg-neutral-50/50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={mod.checked}
                          disabled={mod.disabled}
                          onChange={() => { }}
                          className="mt-1 rounded text-blue-600 border-neutral-300 focus:ring-blue-500"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-sm text-neutral-800 flex items-center gap-1.5">
                            {mod.label}
                            {mod.disabled && <Badge className="bg-neutral-100 text-neutral-500 text-[10px] py-0 border-neutral-200">Required</Badge>}
                          </span>
                          <p className="text-xs text-neutral-400">{mod.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleGenerateSetup}
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Setup...</> : <>Continue to Provisioning <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 1 && setupDetails && (
              <div className="space-y-6">
                {/* Wizard Selection Tabs */}
                <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl max-w-2xl">
                  <button
                    onClick={() => setProvisionMethod("cli")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                      provisionMethod === "cli" ? "bg-white text-neutral-900 shadow" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Cloud Shell (CLI)
                  </button>
                  <button
                    onClick={() => setProvisionMethod("tf")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                      provisionMethod === "tf" ? "bg-white text-neutral-900 shadow" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Terraform
                  </button>
                  <button
                    onClick={() => setProvisionMethod("manual")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                      provisionMethod === "manual" ? "bg-white text-neutral-900 shadow" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Manual Connect
                  </button>
                </div>

                {/* Cloud Shell CLI tab details */}
                {provisionMethod === "cli" && (
                  <Card className="border-neutral-200 bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Deploy via Google Cloud Shell (CLI)</CardTitle>
                      <CardDescription>
                        Run this unified gcloud script in Cloud Shell to enable required APIs, create a service account, assign roles, and authenticate the integration securely.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative group bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => copyToClipboard(setupDetails.cloudShellScript, "cli")}
                          className="absolute top-3 right-3 bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700 text-neutral-300 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedCli ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <pre className="text-neutral-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
                          {setupDetails.cloudShellScript}
                        </pre>
                      </div>

                      <div className="bg-blue-50/40 border border-blue-200/50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-blue-800 font-semibold text-xs">
                            <AlertCircle className="w-4 h-4 text-blue-600" />
                            Running the script in Cloud Shell:
                          </div>
                          <Button
                            asChild
                            size="sm"
                            className="h-8 bg-blue-600 text-xs text-white hover:bg-blue-700"
                          >
                            <a href={setupDetails.cloudShellUrl || "https://shell.cloud.google.com/?show=terminal"} target="_blank" rel="noopener noreferrer">
                              Open Cloud Shell <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                        <ol className="list-decimal pl-4 text-[11px] text-blue-700 space-y-1">
                          <li>Open GCP Console and click the <strong>Activate Cloud Shell</strong> terminal button.</li>
                          <li>Copy the entire script block above and paste it directly into the Cloud Shell terminal.</li>
                          <li>Press Enter. Once completed, the connection will verify automatically below.</li>
                        </ol>
                      </div>

                      <div className="flex items-center gap-2.5 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs text-neutral-500">
                        {isPolling ? (
                          <>
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                            <span>Awaiting credentials callback from GCP Cloud Shell execution...</span>
                          </>
                        ) : (
                          <span>Click generating configurations to start automatic verification callback listener.</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Terraform tab details */}
                {provisionMethod === "tf" && (
                  <Card className="border-neutral-200 bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Deploy via Terraform Configuration</CardTitle>
                      <CardDescription>
                        Integrate your GCP project using HashiCorp Terraform. Apply this template in your GCP directory to provision resources and post credentials.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative group bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => copyToClipboard(setupDetails.terraformTemplate, "tf")}
                          className="absolute top-3 right-3 bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700 text-neutral-300 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedTf ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <pre className="text-neutral-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
                          {setupDetails.terraformTemplate}
                        </pre>
                      </div>

                      <div className="flex items-center gap-2.5 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs text-neutral-500">
                        {isPolling ? (
                          <>
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                            <span>Awaiting credentials callback from Terraform apply execution...</span>
                          </>
                        ) : (
                          <span>Apply configurations to start listening for verification.</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Manual Connection tab details */}
                {provisionMethod === "manual" && (
                  <Card className="border-neutral-200 bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">Provide Credentials Manually</CardTitle>
                      <CardDescription>
                        Enter your GCP Service Account credentials below. You can paste the entire contents of your downloaded Service Account JSON key to fill all fields automatically.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {manualError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          {manualError}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label htmlFor="jsonPaste" className="text-xs text-neutral-600 font-semibold">
                          Service Account JSON Key file
                        </Label>
                        <Textarea
                          id="jsonPaste"
                          value={jsonPaste}
                          onChange={e => handleJsonPasteChange(e.target.value)}
                          placeholder="Paste downloaded Service Account JSON key content here..."
                          className="font-mono text-xs h-32"
                        />
                      </div>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-neutral-200"></div>
                        <span className="flex-shrink mx-4 text-neutral-400 text-xs font-medium">OR INDIVIDUAL FIELDS</span>
                        <div className="flex-grow border-t border-neutral-200"></div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="manualProjectId" className="text-xs text-neutral-600 font-semibold">GCP Project ID</Label>
                          <Input
                            id="manualProjectId"
                            value={manualProjectId}
                            onChange={e => setManualProjectId(e.target.value)}
                            placeholder="e.g. cloudwatcher-production"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="manualClientEmail" className="text-xs text-neutral-600 font-semibold">Service Account Client Email</Label>
                          <Input
                            id="manualClientEmail"
                            value={manualClientEmail}
                            onChange={e => setManualClientEmail(e.target.value)}
                            placeholder="e.g. integration@cloudwatcher-production.iam.gserviceaccount.com"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <Label htmlFor="manualPrivateKey" className="text-xs text-neutral-600 font-semibold">Private Key (PEM format)</Label>
                          <Textarea
                            id="manualPrivateKey"
                            value={manualPrivateKey}
                            onChange={e => setManualPrivateKey(e.target.value)}
                            placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ..."
                            className="font-mono text-xs h-28"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="manualBillingDatasetId" className="text-xs text-neutral-600 font-semibold flex items-center gap-1.5">
                            Billing Export Dataset ID <Badge className="bg-neutral-100 text-neutral-500 text-[9px] py-0 border-neutral-200">Optional</Badge>
                          </Label>
                          <Input
                            id="manualBillingDatasetId"
                            value={manualBillingDatasetId}
                            onChange={e => setManualBillingDatasetId(e.target.value)}
                            placeholder="e.g. gcp_billing"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="manualBillingTableId" className="text-xs text-neutral-600 font-semibold flex items-center gap-1.5">
                            Billing Export Table ID <Badge className="bg-neutral-100 text-neutral-500 text-[9px] py-0 border-neutral-200">Optional</Badge>
                          </Label>
                          <Input
                            id="manualBillingTableId"
                            value={manualBillingTableId}
                            onChange={e => setManualBillingTableId(e.target.value)}
                            placeholder="e.g. gcp_billing_export_v1_XXXXXX"
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={handleSaveManual}
                          disabled={manualSaving || !manualProjectId || !manualClientEmail || !manualPrivateKey}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4"
                        >
                          {manualSaving ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Verifying & Saving...</>
                          ) : (
                            "Connect Manually"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-between pt-4 border-t border-neutral-200">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                    className="text-xs"
                  >
                    Back to Configuration
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
