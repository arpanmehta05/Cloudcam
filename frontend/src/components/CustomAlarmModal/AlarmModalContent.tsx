"use client";

import type React from "react";
import { AlertTriangle, Bell, Loader2, Shield, X } from "@/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "./Field";
import {
  AWS_REGIONS,
  AZURE_REGIONS,
  COMPARISON_OPERATORS,
  GCP_REGIONS,
  SERVICE_ICON_MAP,
  STATISTICS,
} from "./alarm-config";
import type { AlarmForm, AlarmResource, AlarmServiceInfo } from "./types";

interface AlarmModalContentProps {
  title: string;
  selectedProvider: string;
  error: string | null;
  form: AlarmForm;
  isEditing: boolean;
  autoAlarmName: string;
  availableMetrics: AlarmServiceInfo["metrics"];
  alarmServices: AlarmServiceInfo[];
  resources: AlarmResource[];
  snsTopics: AlarmResource[];
  selectedServiceInfo?: AlarmServiceInfo;
  hasResourcesForService: boolean;
  fetchingServices: boolean;
  fetchingResources: boolean;
  fetchingTopics: boolean;
  loading: boolean;
  loadingText: string;
  submitText: string;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onServiceChange: (serviceKey: string) => void;
  updateForm: (patch: Partial<AlarmForm>) => void;
}

export function AlarmModalContent({
  title,
  selectedProvider,
  error,
  form,
  isEditing,
  autoAlarmName,
  availableMetrics,
  alarmServices,
  resources,
  snsTopics,
  selectedServiceInfo,
  hasResourcesForService,
  fetchingServices,
  fetchingResources,
  fetchingTopics,
  loading,
  loadingText,
  submitText,
  canSubmit,
  onClose,
  onSubmit,
  onServiceChange,
  updateForm,
}: AlarmModalContentProps) {
  return (
    <>
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-blue-500 to-indigo-600 shrink-0" />
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
              {selectedProvider === "azure"
                ? "Azure Monitor Alert Rule"
                : selectedProvider === "gcp"
                  ? "GCP Alert Policy"
                  : "CloudWatch Metric Alarm"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col overflow-hidden">
        <div className="px-6 py-6 space-y-5 overflow-y-auto max-h-[60vh] scrollbar-hide">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label={
                selectedProvider === "azure"
                  ? "Azure Service"
                  : selectedProvider === "gcp"
                    ? "GCP Service"
                    : "AWS Service"
              }
              required
            >
              {fetchingServices ? (
                <div className="h-11 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading services...
                </div>
              ) : (
                <Select
                  value={form.service}
                  onValueChange={onServiceChange}
                  disabled={isEditing}
                >
                  <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent className="z-[110]">
                    {alarmServices.map((svc) => {
                      const Icon = SERVICE_ICON_MAP[svc.key];
                      return (
                        <SelectItem key={svc.key} value={svc.key}>
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className="w-4 h-4" />}
                            <span>{svc.label}</span>
                            {svc.resourceCount > 0 ? (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({svc.resourceCount})
                              </span>
                            ) : (
                              <span className="text-[10px] text-destructive ml-1">
                                (none)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Region">
              <Select
                value={form.region}
                onValueChange={(value) => updateForm({ region: value })}
              >
                <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {(selectedProvider === "azure"
                    ? AZURE_REGIONS
                    : selectedProvider === "gcp"
                      ? GCP_REGIONS
                      : AWS_REGIONS
                  ).map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.service && !hasResourcesForService && !fetchingResources && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold mb-1">
                <AlertTriangle className="w-4 h-4" />
                No resources found
              </div>
              <p className="text-amber-700/80 dark:text-amber-300/80 text-xs font-medium leading-relaxed">
                No {selectedServiceInfo?.label || form.service} resources
                detected in {form.region}. Deploy a resource before creating an
                alarm, or choose a different service.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Namespace">
              <Input
                value={form.namespace}
                disabled
                placeholder="Auto-filled from service"
                className="h-11 bg-muted/20 border-border/40 opacity-70 rounded-xl cursor-not-allowed"
              />
            </Field>

            <Field label="Metric Name" required>
              <Select
                value={form.metric}
                onValueChange={(value) => updateForm({ metric: value })}
                disabled={!form.service}
              >
                <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                  <SelectValue
                    placeholder={
                      availableMetrics.length
                        ? "Select a metric"
                        : "No metrics available"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {availableMetrics.map((m) => (
                    <SelectItem key={m.name} value={m.metricName}>
                      {m.name}{" "}
                      <span className="text-muted-foreground text-xs ml-1">
                        ({m.unit})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.service && (
            <Field
              label={`Resource (${selectedServiceInfo?.dimensionKey || "Resource"})`}
              required
            >
              {fetchingResources ? (
                <div className="h-11 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching {selectedServiceInfo?.label.toLowerCase()}...
                </div>
              ) : (
                <Select
                  value={form.dimensionValue}
                  onValueChange={(value) => updateForm({ dimensionValue: value })}
                  disabled={!hasResourcesForService}
                >
                  <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                    <SelectValue
                      placeholder={
                        resources.length === 0
                          ? `No ${selectedServiceInfo?.label.toLowerCase()} available`
                          : "Select a resource"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="z-[110]">
                    {resources.length === 0 && !fetchingResources ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No resources found for this service
                      </div>
                    ) : (
                      resources.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          <Field label="Alarm Name" required>
            <Input
              required
              value={isEditing ? form.name : form.name || autoAlarmName}
              disabled={isEditing}
              placeholder="High-CPU-i-0abc123"
              onChange={(event) => updateForm({ name: event.target.value })}
              className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
            />
            {!isEditing && autoAlarmName && !form.name && (
              <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                Auto-suggested name â€” edit freely or keep as-is.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Comparison" className="md:col-span-2">
              <Select
                value={form.comparison}
                onValueChange={(value) => updateForm({ comparison: value })}
              >
                <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {COMPARISON_OPERATORS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Threshold">
              <Input
                required
                type="number"
                value={form.threshold}
                onChange={(event) =>
                  updateForm({ threshold: Number(event.target.value) })
                }
                className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
              />
            </Field>
            <Field label="Statistic">
              <Select
                value={form.statistic}
                onValueChange={(value) => updateForm({ statistic: value })}
              >
                <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {STATISTICS.map((statistic) => (
                    <SelectItem key={statistic} value={statistic}>
                      {statistic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Period (seconds)">
              <Select
                value={String(form.period)}
                onValueChange={(value) => updateForm({ period: Number(value) })}
              >
                <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="60">1 Minute</SelectItem>
                  <SelectItem value="300">5 Minutes</SelectItem>
                  <SelectItem value="900">15 Minutes</SelectItem>
                  <SelectItem value="3600">1 Hour</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Evaluation Periods">
              <Input
                required
                type="number"
                min={1}
                value={form.evaluationPeriods}
                onChange={(event) =>
                  updateForm({ evaluationPeriods: Number(event.target.value) })
                }
                className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
              />
            </Field>
          </div>

          <Field
            label={
              selectedProvider === "azure"
                ? "Action Group (notifications)"
                : selectedProvider === "gcp"
                  ? "Notification Channel (notifications)"
                  : "SNS Topic (notifications)"
            }
            required
          >
            {fetchingTopics ? (
              <div className="h-11 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {selectedProvider === "azure"
                  ? "Fetching Action Groups..."
                  : selectedProvider === "gcp"
                    ? "Fetching Notification Channels..."
                    : "Fetching SNS topics..."}
              </div>
            ) : (
              <Select
                value={form.snsTopicArn}
                onValueChange={(value) => updateForm({ snsTopicArn: value })}
              >
                <SelectTrigger className="h-11 w-full bg-muted/30 border-border/80 hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl">
                  <SelectValue
                    placeholder={
                      selectedProvider === "azure"
                        ? "Select an Action Group"
                        : selectedProvider === "gcp"
                          ? "Select a Notification Channel"
                          : "Select an SNS topic"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {snsTopics.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {selectedProvider === "azure"
                        ? "No Action Groups found"
                        : selectedProvider === "gcp"
                          ? "No Notification Channels found"
                          : "No SNS topics found"}{" "}
                      in {form.region}
                    </div>
                  ) : (
                    snsTopics.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}{" "}
                        <span className="text-muted-foreground text-[10px] ml-1 font-mono">
                          {t.value}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed mt-2">
              Alarm state changes will be sent to this{" "}
              {selectedProvider === "azure"
                ? "Action Group"
                : selectedProvider === "gcp"
                  ? "Notification Channel"
                  : "SNS topic"}
              .
            </p>
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <Shield className="w-4 h-4 text-emerald-500" />
            {selectedProvider === "azure"
              ? "Azure Active Directory OAuth"
              : selectedProvider === "gcp"
                ? "GCP Service Account Auth"
                : "IAM cross-account role"}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl font-bold"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/10"
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {loadingText}
                </>
              ) : (
                submitText
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
