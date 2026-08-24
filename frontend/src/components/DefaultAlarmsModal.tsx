"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Bell,
  Zap,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Info,
  Activity,
  Server,
  Laptop,
  Database,
  Globe,
  Network,
  Cpu,
  MessageSquare,
  FolderOpen,
} from "@/icons";
import { Button } from "@/components/ui/button";
import { authFetchJson } from "@/lib/auth-fetch";
import { useRegion } from "@/context/RegionContext";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import { getProviderAlarmLabel } from "@/lib/cloud/provider-services";
import { cn } from "@/lib/utils";

interface DefaultAlarmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SERVICE_ICONS: Record<string, any> = {
  ec2: <Server className="w-4 h-4" />,
  lambda: <Zap className="w-4 h-4" />,
  rds: <Database className="w-4 h-4" />,
  ecs: <Activity className="w-4 h-4" />,
  amplify: <Globe className="w-4 h-4" />,
  dynamodb: <Cpu className="w-4 h-4" />,
  sqs: <MessageSquare className="w-4 h-4" />,
  alb: <Network className="w-4 h-4" />,
  s3: <FolderOpen className="w-4 h-4" />,
};

export function DefaultAlarmsModal({
  isOpen,
  onClose,
  onSuccess,
}: DefaultAlarmsModalProps) {
  const { selectedProvider } = useRegion();
  const providerCopy = getProviderCopy(selectedProvider);
  const [snsArn, setSnsArn] = useState<string>("");
  const [step, setStep] = useState<"preview" | "provisioning" | "result">(
    "preview",
  );
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    } else {
      // Reset state when closed
      setTimeout(() => {
        setStep("preview");
        setResult(null);
        setError(null);
      }, 300);
    }
  }, [isOpen]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetchJson(
        `/api/${selectedProvider}/alarms/defaults`,
      );
      if (data.success) {
        setPreview(data);
      } else {
        setError(data.error || "Failed to load alarm preview");
      }
    } catch (err: any) {
      console.error("Preview error:", err);
      setError(
        err.message || "An unexpected error occurred while fetching preview",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    setStep("provisioning");
    setError(null);
    const trimmedSnsArn = snsArn.trim();
    if (!trimmedSnsArn) {
      const notificationTarget =
        selectedProvider === "azure"
          ? "Action Group Resource ID"
          : selectedProvider === "gcp"
            ? "Notification Channel ID"
            : "SNS Topic ARN";
      setError(
        `${notificationTarget} is required so default alarms can send notifications.`,
      );
      setStep("preview");
      return;
    }
    try {
      const data = await authFetchJson(
        `/api/${selectedProvider}/alarms/defaults`,
        undefined,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alarmActions: [trimmedSnsArn],
          }),
        },
      );
      if (data.success) {
        setResult(data);
        setStep("result");
        onSuccess();
      } else {
        setError(data.error || "Failed to provision alarms");
        setStep("preview"); // Fallback to preview to show error
      }
    } catch (err: any) {
      console.error("Provision error:", err);
      setError(
        err.message || "An unexpected error occurred during provisioning",
      );
      setStep("preview");
    }
  };

  if (!isOpen || !mounted) return null;

  const actionLabel =
    selectedProvider === "azure"
      ? "Action Group Resource ID"
      : selectedProvider === "gcp"
        ? "Notification Channel ID"
        : "SNS Topic ARN";
  const actionPlaceholder =
    selectedProvider === "azure"
      ? "/subscriptions/.../resourceGroups/.../providers/Microsoft.Insights/actionGroups/..."
      : selectedProvider === "gcp"
        ? "projects/.../notificationChannels/..."
        : "arn:aws:sns:region:account-id:topic-name";
  const alarmProviderLabel = getProviderAlarmLabel(selectedProvider);
  const notificationHelp =
    selectedProvider === "azure"
      ? "CloudWatcher does not create an Action Group for you. Enter an Action Group resource ID from your Azure subscription so Azure Monitor can publish alert notifications."
      : selectedProvider === "gcp"
        ? "CloudWatcher does not create a notification channel for you. Enter a Cloud Monitoring notification channel ID from your GCP project so alert policies can publish notifications."
        : "CloudWatcher does not create an SNS topic for you. Enter a topic ARN from your AWS account so CloudWatch can publish alarm notifications.";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 overflow-y-auto bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 py-12">
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] my-auto text-foreground relative">
        {/* Accent top gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-blue-500 to-indigo-600 shrink-0" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Provision Default Alarms
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Global Best Practices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {step === "preview" && (
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-lg shadow-primary/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col gap-1">
                  <span className="text-primary-foreground/80 text-xs font-bold uppercase tracking-wider">
                    Plan Summary
                  </span>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-4xl font-black">
                      {loading ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : (
                        preview?.totalAlarms || 0
                      )}
                    </h2>
                    <span className="text-lg font-bold text-primary-foreground/80">
                      {alarmProviderLabel} to be provisioned
                    </span>
                  </div>
                  <p className="text-sm text-primary-foreground/75 mt-2 font-medium">
                    Across {preview?.totalResources || 0} discovered resources
                    in your connected regions.
                  </p>
                </div>
                <Activity className="absolute -right-4 -bottom-4 w-32 h-32 text-primary-foreground/10 rotate-12" />
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                  Service Breakdown
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {preview && Object.keys(preview.summary || {}).length > 0 ? (
                    Object.entries(preview.summary || {}).map(
                      ([service, data]: [string, any]) => (
                        <div
                          key={service}
                          className="p-4 rounded-xl border border-border bg-muted/40 flex items-center gap-3"
                        >
                          <div className="p-2 bg-card rounded-lg shadow-sm text-foreground">
                            {SERVICE_ICONS[service] || (
                              <Activity className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground uppercase">
                              {service}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {data.count} alarms • {data.resources} targets
                            </span>
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="col-span-2 text-center py-4 text-muted-foreground text-sm italic">
                      No eligible resources found needing default alarms.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                  Notification Settings
                </h4>
                <div className="p-5 bg-primary/5 rounded-2xl border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Bell className="w-4 h-4" />
                    {actionLabel}
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full h-11 px-4 py-2.5 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-mono text-foreground"
                    placeholder={actionPlaceholder}
                    value={snsArn}
                    onChange={(e) => setSnsArn(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                    {notificationHelp}
                  </p>
                </div>
              </div>

              <div className="p-5 bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                  <Shield className="w-4 h-4" />
                  Important Information
                </div>
                <ul className="space-y-2">
                  {[
                    "Alarms follow naming convention: rabbittwatch-{service}-{id}",
                    "Existing alarms with matching names will be skipped automatically.",
                    "Provisioning takes ~10-30 seconds depending on resource count.",
                  ].map((text, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {step === "provisioning" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-muted" />
                <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-primary animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Provisioning Alarms
                </h3>
                <p className="text-sm text-muted-foreground font-medium max-w-xs mx-auto mt-2">
                  We're communicating with the {providerCopy.metricsSource}{" "}
                  APIs. Please stay on this screen.
                </p>
              </div>
            </div>
          )}

          {step === "result" && (
            <div className="space-y-6">
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground">
                    Provisioning Complete
                  </h3>
                  <p className="text-muted-foreground font-medium mt-1">
                    Your monitoring infrastructure has been reinforced.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Created",
                    val: result?.created,
                    bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
                    textCol: "text-emerald-500",
                    icon: <Zap className="w-3.5 h-3.5" />,
                  },
                  {
                    label: "Skipped",
                    val: result?.skipped,
                    bg: "bg-primary/10 border-primary/20 text-primary",
                    textCol: "text-primary",
                    icon: <Info className="w-3.5 h-3.5" />,
                  },
                  {
                    label: "Failed",
                    val: result?.failed,
                    bg: "bg-destructive/10 border-destructive/20 text-destructive",
                    textCol: "text-destructive",
                    icon: <AlertTriangle className="w-3.5 h-3.5" />,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 ${item.bg}`}
                  >
                    <div className="flex items-center gap-1.5 opacity-70">
                      {item.icon}
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {item.label}
                      </span>
                    </div>
                    <span className={cn("text-3xl font-black", item.textCol)}>
                      {item.val || 0}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  <span className="font-bold text-foreground">Next Steps:</span>{" "}
                  Your new alert rules are now in the
                  <span className="font-bold text-primary mx-1">
                    Initializing
                  </span>{" "}
                  state. They will transition to{" "}
                  <span className="text-emerald-500 font-bold">Active</span>{" "}
                  within roughly 5-10 minutes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Signed off by Cloud-Watcher
            </span>
          </div>

          <div className="flex gap-2">
            {step === "preview" && (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="rounded-xl h-11 font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProvision}
                  disabled={loading || !preview?.totalAlarms || !snsArn.trim()}
                  className="bg-primary hover:bg-primary/95 rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20"
                >
                  Setup {preview?.totalAlarms || 0} Alarms
                </Button>
              </>
            )}
            {step === "result" && (
              <Button
                onClick={onClose}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-10 font-bold"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
