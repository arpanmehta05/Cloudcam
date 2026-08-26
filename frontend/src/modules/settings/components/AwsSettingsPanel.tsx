"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CloudIcon,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  LayoutList,
  ExternalLink,
  AlertCircle,
  Brain,
  FileText
} from "@/icons";
import { DashboardHeader } from "@/components/DashboardHeader";
import { cn } from "@/lib/utils";
import { DynamicModal } from "@/components/ui/DynamicModal";
import { useAwsSettings } from "../hooks/useCloudSettings";
import { ProviderConnectionTabs } from "./ProviderConnectionTabs";

const BRAND_NAME = "Cloudcam";
const RabbittizeStackName = "Rabbittize-Integration";

const STEPS = [
  {
    title: "Setup Configuration",
    description: "Choose your workspace and region.",
    icon: LayoutList,
  },
  {
    title: "Deploy Stack",
    description: "One-click CloudFormation deployment in your AWS account.",
    icon: CloudIcon,
  },
  {
    title: "Verify Connection",
    description: "Wait for the pingback from AWS to confirm setup.",
    icon: ShieldCheck,
  }
];

function ConnectExistingStack({ onConnected, inline = false }: { onConnected: (roleArn: string, externalId: string) => Promise<boolean>; inline?: boolean }) {
  const [roleArn, setRoleArn] = useState("");
  const [externalId, setExternalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(inline);

  const handleSave = async () => {
    if (!roleArn.startsWith("arn:aws:iam::")) {
      setErr("Invalid RoleArn format. Expected: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME");
      return;
    }
    if (!externalId.trim()) {
      setErr("ExternalId is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    const success = await onConnected(roleArn, externalId.trim());
    setSaving(false);
    if (!success) {
      setErr("Failed to save credentials");
    }
  };

  return (
    <div className={inline ? "w-full" : "mt-6 w-full max-w-md"}>
      {!open ? (
        <Button
          variant="link"
          size="sm"
          onClick={() => setOpen(true)}
          className="text-xs text-neutral-400 hover:text-blue-600 p-0 h-auto"
        >
          Already deployed the stack? Connect it here
        </Button>
      ) : (
        <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-3">
          <p className="text-xs font-medium text-neutral-600">
            Enter the values from your CloudFormation stack&apos;s <strong>Outputs</strong> tab and the <strong>ExternalId</strong> used during setup:
          </p>
          <div className="space-y-2">
            <Label htmlFor="roleArn" className="text-xs text-neutral-500">RoleArn</Label>
            <Input
              id="roleArn"
              type="text"
              value={roleArn}
              onChange={e => setRoleArn(e.target.value)}
              placeholder="arn:aws:iam::123456789012:role/RabbittizeCrossAccountRole"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="externalId" className="text-xs text-neutral-500">ExternalId</Label>
            <Input
              id="externalId"
              type="text"
              value={externalId}
              onChange={e => setExternalId(e.target.value)}
              placeholder="e.g. 3f7a1c2d-8e4b-4f0a-9b2c-1d5e6f7a8b9c"
              className="text-xs font-mono"
            />
            <p className="text-xs text-neutral-400">Found in your CloudFormation stack&apos;s Parameters tab under <code>RabbittizeExternalID</code>.</p>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !roleArn || !externalId} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Connecting...</> : "Connect"}
            </Button>
            {!inline && <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AwsSettingsPanel() {
  const {
    isAwsConnected,
    connectionMeta,
    currentStep,
    isLoading,
    isPolling,
    error,
    checkingConnection,
    enableAiObservability,
    enableLogForwarding,
    isDisconnecting,
    isConfirmOpen,
    setEnableAiObservability,
    setEnableLogForwarding,
    setCurrentStep,
    setIsConfirmOpen,
    refreshConnectionStatus,
    handleConnect,
    handleConnectExisting,
    confirmDisconnect,
  } = useAwsSettings();

  const openStackUpdateConsole = () => {
    const stackUrl = `https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringText=${encodeURIComponent(RabbittizeStackName)}&filteringStatus=active&viewNested=true`;
    window.open(stackUrl, "_blank");
  };

  const openLatestTemplate = () => {
    const url = process.env.NEXT_PUBLIC_TEMPLATE_URL || "https://rabbittize-cf-templates.s3.us-east-1.amazonaws.com/rabbittize-aws-integration.json";
    window.open(url, "_blank");
  };

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
        <ProviderConnectionTabs activeProvider="aws" />

        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">
            Connect your AWS Infrastructure
          </h1>
          <p className="text-neutral-500 text-lg max-w-2xl">
            {BRAND_NAME} securely connects to your AWS account using a Cross-Account IAM Role to provide real-time optimization and health metrics.
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
                  <span className={cn(
                    "font-semibold text-sm",
                    currentStep === idx ? "text-neutral-900" : "text-neutral-500"
                  )}>Step {idx + 1}</span>
                </div>
                <h3 className="font-medium text-neutral-900">{step.title}</h3>
                <p className="text-xs text-neutral-500 mt-1">{step.description}</p>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 z-10 hidden md:block">
                  <ArrowRight className="w-4 h-4 text-neutral-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main Content Card */}
        <Card className="border-neutral-200/60 shadow-xl shadow-neutral-200/20 bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">One-Click Stack Creation</CardTitle>
                <CardDescription>We use AWS CloudFormation to securely provision the required read-only permissions.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                Recommended
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkingConnection && (
              <div className="text-xs text-muted-foreground">Checking AWS connection status...</div>
            )}

            {isAwsConnected && (
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/60 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">AWS is connected</p>
                    {connectionMeta.roleArn && (
                      <p className="text-xs text-emerald-700/90 mt-1 break-all font-mono">{connectionMeta.roleArn}</p>
                    )}
                    {connectionMeta.connectedAt && (
                      <p className="text-xs text-emerald-700/80 mt-1">
                        Connected: {new Date(connectionMeta.connectedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">Connected</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={openStackUpdateConsole}>
                    Update Stack to Latest
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={openLatestTemplate}>
                    Open Latest Template
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={refreshConnectionStatus}>
                    Refresh Status
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setIsConfirmOpen(true)} disabled={isDisconnecting}>
                    {isDisconnecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      "Disconnect Account"
                    )}
                  </Button>
                </div>

                <p className="text-xs text-emerald-800/90">
                  In CloudFormation, open the integration stack, choose Update, then replace the current template using the latest template URL.
                </p>
              </div>
            )}

            <div className="bg-secondary p-4 rounded-lg border border-border space-y-4">
              <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Select modules to enable:
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { id: "core", label: "Core Monitoring", desc: "CloudWatch metrics & health", checked: true, disabled: true },
                  { id: "cost", label: "Cost Analytics", desc: "CUR, billing, projections", checked: true, disabled: true },
                  { id: "security", label: "Security Insights", desc: "IAM, GuardDuty, SecurityHub", checked: true, disabled: true },
                  { id: "ai", label: "AI Observability", desc: "Bedrock, AI metrics & costs", checked: enableAiObservability, disabled: false, icon: Brain },
                  { id: "logs", label: "Log Forwarding", desc: "Advanced AI app log traces", checked: enableLogForwarding, disabled: false, icon: FileText },
                ].map((mod) => (
                  <label
                    key={mod.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      mod.checked
                        ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200/50"
                        : "border-neutral-200 hover:border-neutral-300",
                      mod.disabled && "cursor-default opacity-80"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={mod.checked}
                      disabled={mod.disabled}
                      onChange={(e) => {
                        if (mod.id === "ai") setEnableAiObservability(e.target.checked);
                        if (mod.id === "logs") setEnableLogForwarding(e.target.checked);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-800 flex items-center gap-1.5">
                        {mod.label}
                        {mod.id === "ai" && <Badge variant="outline" className="text-[8px] bg-purple-50 text-purple-700 border-purple-200">NEW</Badge>}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">{mod.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {enableLogForwarding && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <strong>Note:</strong> Log Forwarding deploys a Lambda function in your AWS account that forwards AI application logs to {BRAND_NAME}.
                    This enables richer trace analysis but incurs minimal Lambda execution costs.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 py-4">
              {currentStep === 0 && (
                <div className="w-full flex flex-col items-center">
                  <Button
                    size="lg"
                    className="w-full max-w-sm h-14 text-lg"
                    onClick={handleConnect}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        Connect AWS Account
                        <ExternalLink className="w-5 h-5 ml-3" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    You will be redirected to the AWS Console in a new tab.<br />
                    Please ensure you are logged into your primary AWS account.
                  </p>
                  <ConnectExistingStack onConnected={handleConnectExisting} />
                </div>
              )}

              {currentStep === 1 && (
                <div className="w-full flex flex-col items-center p-8 bg-secondary rounded-lg border border-border border-dashed">
                  <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
                    <div className="relative z-10 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Awaiting Connection...</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    We've opened the AWS CloudFormation console. After you click "Create Stack", it takes about 1-2 minutes for the integration to complete.
                  </p>
                  <div className="mt-8 flex gap-3">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      Cancel
                    </Button>
                    <Button variant="secondary" onClick={() => window.open("https://console.aws.amazon.com/cloudformation", "_blank")}>
                      Return to AWS
                    </Button>
                  </div>

                  <ConnectExistingStack onConnected={handleConnectExisting} />
                </div>
              )}

              {currentStep === 2 && (
                <div className="w-full flex flex-col items-center p-8 bg-green-50/30 rounded-lg border border-green-100">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Integration Successful!</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Your AWS account is now securely connected to {BRAND_NAME}. We've started indexing your metrics and cost reports.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Button variant="outline" onClick={openStackUpdateConsole}>
                      Update Stack to Latest
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="outline" onClick={openLatestTemplate}>
                      Open Latest Template
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="destructive" onClick={() => setIsConfirmOpen(true)} disabled={isDisconnecting}>
                      {isDisconnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        "Disconnect Account"
                      )}
                    </Button>
                  </div>
                  <Button
                    className="mt-8"
                    onClick={() => window.location.href = "/"}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="flex gap-4 p-5 bg-secondary rounded-lg">
          <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border shrink-0">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-1">Secure & Read-Only</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {BRAND_NAME} never stores your AWS credentials. We use IAM Roles with least-privilege permissions. You can revoke access at any time by deleting the CloudFormation stack in your AWS console.
            </p>
          </div>
        </div>
      </div>

      <DynamicModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Disconnect AWS Account"
        description="Are you sure you want to disconnect your AWS account? This will revoke all read-only permissions access and clear all cached AWS data."
        type="danger"
        primaryAction={{
          label: "Disconnect",
          onClick: async () => {
            await confirmDisconnect();
          },
          isLoading: isDisconnecting,
          variant: "destructive"
        }}
        secondaryAction={{
          label: "Cancel",
          onClick: () => setIsConfirmOpen(false)
        }}
      />
    </div>
  );
}
