"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CloudIcon,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  LayoutList,
  AlertCircle,
  Terminal,
  Code,
  Settings,
} from "@/icons";
import { DashboardHeader } from "@/components/DashboardHeader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useAzureSettings } from "../hooks/useCloudSettings";
import { ProviderConnectionTabs } from "./ProviderConnectionTabs";

// Subcomponents
import { AzureStatusCard } from "./AzureSettings/AzureStatusCard";
import { OneClickProvision } from "./AzureSettings/OneClickProvision";
import { CliProvision } from "./AzureSettings/CliProvision";
import { TerraformProvision } from "./AzureSettings/TerraformProvision";
import { ManualProvision } from "./AzureSettings/ManualProvision";

const BRAND_NAME = "Cloudcam";

const STEPS = [
  { title: "Setup Configuration", description: "Choose modules and monitoring options.", icon: LayoutList },
  { title: "Provision Credentials", description: "Deploy via Cloud Shell, Terraform, or manual entry.", icon: Settings },
  { title: "Verify Connection", description: "Confirm connection with your Azure subscription.", icon: ShieldCheck }
];

export function AzureSettingsPanel() {
  const { user } = useAuth();
  const settings = useAzureSettings();
  const {
    isAzureConnected, connectionMeta, currentStep, isLoading, isPolling, error, checkingConnection,
    isDisconnecting, modules, setupDetails, provisionMethod, copiedCli, copiedTf,
    oneClickTenantId, oneClickSubId, oneClickPrincipalId, oneClickEnableLogAnalytics,
    generatingLink, deployUrl, downloadingTemplate, manualType, manualTenantId, manualSubId,
    manualBillingAccountId, manualClientId, manualClientSecret, manualPrincipalId, manualSaving,
    manualError, setProvisionMethod, setOneClickTenantId, setOneClickSubId, setOneClickPrincipalId,
    setOneClickEnableLogAnalytics, setManualType, setManualTenantId, setManualSubId,
    setManualBillingAccountId, setManualClientId, setManualClientSecret, setManualPrincipalId,
    toggleModule, handleGenerateSetup, handleDownloadTemplate, handleGenerateDeployUrl,
    handleSaveManual, handleDisconnect, copyToClipboard, refreshConnectionStatus,
    setDeployUrl, setCurrentStep,
  } = settings;

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
        <ProviderConnectionTabs activeProvider="azure" />

        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">
            Connect your Azure Infrastructure
          </h1>
          <p className="text-neutral-500 text-lg max-w-2xl">
            {BRAND_NAME} integrates seamlessly with Azure using AD Service Principals to monitor metrics, optimize subscription costs, and analyze compliance.
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
                    {currentStep > idx ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
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

        {/* Connection status view */}
        {isAzureConnected && currentStep === 2 ? (
          <AzureStatusCard
            connectionMeta={connectionMeta}
            handleDisconnect={handleDisconnect}
            isDisconnecting={isDisconnecting}
            brandName={BRAND_NAME}
          />
        ) : (
          /* Step Wizard rendering */
          <div className="space-y-6">
            {currentStep === 0 && (
              <Card className="border-neutral-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle>Select Cloud Observability Modules</CardTitle>
                  <CardDescription>
                    Configure which services {BRAND_NAME} should scan and optimize within your subscription.
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
                    onClick={() => setProvisionMethod("oneclick")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                      provisionMethod === "oneclick" ? "bg-white text-neutral-900 shadow" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <CloudIcon className="w-3.5 h-3.5" />One-Click Deploy
                  </button>
                  <button
                    onClick={() => setProvisionMethod("cli")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                      provisionMethod === "cli" ? "bg-white text-neutral-900 shadow" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Terminal className="w-3.5 h-3.5" />Cloud Shell (CLI)
                  </button>
                  <button
                    onClick={() => setProvisionMethod("tf")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                      provisionMethod === "tf" ? "bg-white text-neutral-900 shadow" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Code className="w-3.5 h-3.5" />Terraform
                  </button>
                  <button
                    onClick={() => setProvisionMethod("manual")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                      provisionMethod === "manual" ? "bg-white text-neutral-900 shadow" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Settings className="w-3.5 h-3.5" />Manual Connect
                  </button>
                </div>

                {/* Provision Panels */}
                {provisionMethod === "oneclick" && (
                  <OneClickProvision
                    oneClickTenantId={oneClickTenantId}
                    setOneClickTenantId={setOneClickTenantId}
                    oneClickSubId={oneClickSubId}
                    setOneClickSubId={setOneClickSubId}
                    oneClickPrincipalId={oneClickPrincipalId}
                    setOneClickPrincipalId={setOneClickPrincipalId}
                    oneClickEnableLogAnalytics={oneClickEnableLogAnalytics}
                    setOneClickEnableLogAnalytics={setOneClickEnableLogAnalytics}
                    deployUrl={deployUrl}
                    setDeployUrl={setDeployUrl}
                    generatingLink={generatingLink}
                    handleGenerateDeployUrl={handleGenerateDeployUrl}
                    handleDownloadTemplate={handleDownloadTemplate}
                    downloadingTemplate={downloadingTemplate}
                    setupDetails={setupDetails}
                    user={user}
                    isPolling={isPolling}
                  />
                )}

                {provisionMethod === "cli" && (
                  <CliProvision
                    setupDetails={setupDetails}
                    copyToClipboard={copyToClipboard}
                    copiedCli={copiedCli}
                  />
                )}

                {provisionMethod === "tf" && (
                  <TerraformProvision
                    setupDetails={setupDetails}
                    copyToClipboard={copyToClipboard}
                    copiedTf={copiedTf}
                  />
                )}

                {provisionMethod === "manual" && (
                  <ManualProvision
                    manualType={manualType}
                    setManualType={setManualType}
                    manualTenantId={manualTenantId}
                    setManualTenantId={setManualTenantId}
                    manualSubId={manualSubId}
                    setManualSubId={setManualSubId}
                    manualBillingAccountId={manualBillingAccountId}
                    setManualBillingAccountId={setManualBillingAccountId}
                    manualClientId={manualClientId}
                    setManualClientId={setManualClientId}
                    manualClientSecret={manualClientSecret}
                    setManualClientSecret={setManualClientSecret}
                    manualPrincipalId={manualPrincipalId}
                    setManualPrincipalId={setManualPrincipalId}
                    manualSaving={manualSaving}
                    manualError={manualError}
                    handleSaveManual={handleSaveManual}
                    setCurrentStep={setCurrentStep}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
