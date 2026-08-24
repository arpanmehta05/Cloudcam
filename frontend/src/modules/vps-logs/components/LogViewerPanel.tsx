"use client";

import React from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bug,
  RefreshCw,
  Server,
  Trash2,
  Check,
  Shield,
  Search,
  Filter,
  Container,
} from "@/icons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type useVpsLogs } from "../hooks/useVpsLogs";
import { AgentListPanel } from "./AgentListPanel";
import { DateTimePicker } from "./LogViewer/DateTimePicker";
import { MiniMetricChart } from "./LogViewer/MiniMetricChart";
import { isPm2Noise, renderFormattedLogEntry } from "./LogViewer/log-formatting";

interface LogViewerPanelProps {
  state: ReturnType<typeof useVpsLogs>;
}

export function LogViewerPanel({ state: sim }: LogViewerPanelProps) {
  const levelOptions = [
    { value: "All", label: "All levels" },
    { value: "error", label: "Errors" },
    { value: "warn", label: "Warnings" },
    { value: "info", label: "Info" },
    { value: "debug", label: "Debug" },
  ];

  const alarmTypeOptions = [
    { value: "metric_threshold", label: "Metric threshold" },
    { value: "log_volume", label: "Log volume" },
  ];

  const alarmMetricOptions = [
    { value: "cpuPercent", label: "CPU %" },
    { value: "ramPercent", label: "RAM %" },
    { value: "diskUsedPercent", label: "Disk %" },
  ];

  const alarmLevelOptions = [
    { value: "error", label: "Errors" },
    { value: "warn", label: "Warnings" },
    { value: "all", label: "All logs" },
    { value: "info", label: "Info" },
    { value: "debug", label: "Debug" },
  ];

  const sourceOptions = [
    { value: "All", label: "All Sources" },
    { value: "docker", label: "Docker" },
    { value: "pm2", label: "PM2" },
    { value: "nginx", label: "Nginx" },
    { value: "apache", label: "Apache" },
    { value: "system", label: "System" },
  ];

  return (
    <div>
      <DashboardHeader
        timeRange={sim.timeRange}
        onTimeRangeChange={sim.setTimeRange}
        onRefresh={() => sim.fetchAll({ forceRefresh: true })}
        onAutoRefresh={() => sim.fetchAll({ forceRefresh: true, background: true })}
        isLoading={sim.loading}
        lastUpdated={sim.lastUpdated}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Time Filter</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose a dashboard window or a custom archive range.</p>
            </div>
            <Badge variant={sim.hasCustomTimeFilter ? "default" : "outline"}>
              {sim.hasCustomTimeFilter ? "Custom range" : `Last ${sim.timeRange}`}
            </Badge>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <DateTimePicker
              label="Start Date & Time"
              value={sim.startDate}
              onChange={sim.setStartDate}
            />
            <div className="hidden sm:flex items-center pb-3 text-muted-foreground">
              <ArrowRight className="w-4 h-4" />
            </div>
            <DateTimePicker
              label="End Date & Time"
              value={sim.endDate}
              onChange={sim.setEndDate}
            />
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                sim.setStartDate("");
                sim.setEndDate("");
              }}
            >
              Reset Time
            </Button>
          </div>
        </div>

        <div className="relative z-10 hover:z-20 focus-within:z-30 transition-all rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> Log Filters
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Filter the log rows separately from the time window.</p>
            </div>
            <Badge variant={sim.activeLogFilterCount ? "default" : "outline"}>
              {sim.activeLogFilterCount ? `${sim.activeLogFilterCount} active` : "No filters"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CustomDropdown
              value={sim.selectedLevel}
              onChange={(value) => sim.setSelectedLevel(value as any)}
              options={levelOptions}
              placeholder="Level"
              searchable={false}
              className="w-full"
            />
            <Input
              value={sim.serviceFilter}
              onChange={(event) => sim.setServiceFilter(event.target.value)}
              placeholder="Service name"
            />
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={sim.logSearch}
                onChange={(event) => sim.setLogSearch(event.target.value)}
                placeholder="Search messages"
              />
            </div>
            <Button
              variant="outline"
              className="sm:col-span-2"
              onClick={() => {
                sim.setSelectedAgent("all");
                sim.setSelectedSource("All");
                sim.setSelectedLevel("All");
                sim.setServiceFilter("");
                sim.setLogSearch("");
              }}
            >
              Clear Log Filters
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Total Logs</p>
                <Server className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-semibold">{sim.summary?.totals.logs ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Errors</p>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-3xl font-semibold text-red-400">{sim.summary?.totals.errors ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Warnings</p>
                <Bug className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-3xl font-semibold text-amber-300">{sim.summary?.totals.warnings ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Agents</p>
                <Container className="w-4 h-4 text-primary" />
              </div>
              <p className="text-3xl font-semibold">{sim.agents.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="relative z-10 hover:z-20 focus-within:z-30 transition-all">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Mail Alert Rule Policy</CardTitle>
                <CardDescription>Configure threshold and cooldown rules for signature-based error alert emails</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Error Threshold (counts)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Threshold"
                  value={sim.policyErrorThreshold}
                  onChange={(event) => sim.setPolicyErrorThreshold(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Window (minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Window"
                  value={sim.policyWindow}
                  onChange={(event) => sim.setPolicyWindow(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cooldown (minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Cooldown"
                  value={sim.policyCooldown}
                  onChange={(event) => sim.setPolicyCooldown(event.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={sim.isSavingPolicy}
                onClick={sim.handleSaveAlertPolicy}
              >
                {sim.isSavingPolicy ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : sim.savedPolicySuccess ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-400" /> Saved
                  </>
                ) : (
                  "Save Policy"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              This is a rolling backend counter. You will receive an email when the same error signature appears <span className="font-semibold text-primary">{sim.summary?.alertPolicy?.errorSignatureThreshold ?? 25} times</span> within <span className="font-semibold text-primary">{sim.summary?.alertPolicy?.windowMinutes ?? 15} minutes</span>, with a cooldown of <span className="font-semibold text-primary">{sim.summary?.alertPolicy?.cooldownMinutes ?? 60} minutes</span>. Recalculated upon log ingestion.
            </p>
          </CardContent>
        </Card>

        <Card className="relative z-10 hover:z-20 focus-within:z-30 transition-all">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>Own Logs & Metrics Alarms</CardTitle>
                <CardDescription>SMTP notifications for collector metrics and application log volume</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
              <Input
                className="lg:col-span-2"
                placeholder="Alarm name"
                value={sim.alarmName}
                onChange={(event) => sim.setAlarmName(event.target.value)}
              />
              <CustomDropdown
                value={sim.alarmType}
                onChange={(value) => {
                  const nextType = value as any;
                  sim.setAlarmType(nextType);
                  sim.setAlarmName(nextType === "metric_threshold" ? "High CPU" : "Error burst");
                  sim.setAlarmThreshold(nextType === "metric_threshold" ? "80" : "25");
                }}
                options={alarmTypeOptions}
                placeholder="Type"
                searchable={false}
                className="w-full"
              />
              {sim.alarmType === "metric_threshold" ? (
                <CustomDropdown
                  value={sim.alarmMetric}
                  onChange={(value) => sim.setAlarmMetric(value as any)}
                  options={alarmMetricOptions}
                  placeholder="Metric"
                  searchable={false}
                  className="w-full"
                />
              ) : (
                <CustomDropdown
                  value={sim.alarmLevel}
                  onChange={(value) => sim.setAlarmLevel(value as any)}
                  options={alarmLevelOptions}
                  placeholder="Level"
                  searchable={false}
                  className="w-full"
                />
              )}
              <Input
                type="number"
                min="0"
                placeholder="Threshold"
                value={sim.alarmThreshold}
                onChange={(event) => sim.setAlarmThreshold(event.target.value)}
              />
              <Input
                type="number"
                min="1"
                placeholder="Window min"
                value={sim.alarmWindow}
                onChange={(event) => sim.setAlarmWindow(event.target.value)}
              />
              <Input
                type="number"
                min="1"
                placeholder="Cooldown min"
                value={sim.alarmCooldown}
                onChange={(event) => sim.setAlarmCooldown(event.target.value)}
              />
              <Button onClick={sim.createAlarmRule} disabled={sim.savingAlarm || !sim.alarmName.trim()}>
                {sim.savingAlarm ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
                Create Alarm
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {sim.alarmRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No custom alarms yet.</p>
              ) : (
                sim.alarmRules.map((rule) => (
                  <div key={rule.id} className="border border-border rounded-lg p-3 bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{rule.name}</p>
                          <Badge variant={rule.enabled ? "default" : "outline"}>{rule.enabled ? "Enabled" : "Paused"}</Badge>
                          <Badge variant="secondary">{rule.severity}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {rule.type === "metric_threshold"
                            ? `${rule.metric} ${rule.comparator} ${rule.threshold}%`
                            : `${rule.level} logs ${rule.comparator} ${rule.threshold} in ${rule.windowMinutes} min`}
                          {rule.agentId && rule.agentId !== "all" ? ` | ${rule.agentId}` : " | all agents"}
                          {rule.source && rule.source !== "all" ? ` | ${rule.source}` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Last fired: {rule.lastTriggeredAt ? `${new Date(rule.lastTriggeredAt).toLocaleString()} (${rule.lastValue ?? "n/a"})` : "Never"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => sim.toggleAlarmRule(rule)}>
                          {rule.enabled ? "Pause" : "Enable"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => sim.setAlarmToDelete(rule)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniMetricChart
            title="VPS CPU"
            value={sim.currentMetrics.cpu}
            data={sim.hostMetricsData}
            dataKey="cpuPercent"
            color="#22c55e"
          />
          <MiniMetricChart
            title="VPS RAM"
            value={sim.currentMetrics.ram}
            data={sim.hostMetricsData.map((point) => ({
              ...point,
              ramUsedMb: point.ramTotalMb > 0 ? (point.ramUsedMb / point.ramTotalMb) * 100 : 0,
            }))}
            dataKey="ramUsedMb"
            color="#60a5fa"
          />
          <MiniMetricChart
            title="VPS Disk"
            value={sim.currentMetrics.disk}
            data={sim.hostMetricsData}
            dataKey="diskUsedPercent"
            color="#f59e0b"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-0">
              <CardTitle>Log Volume Timeline</CardTitle>
              <CardDescription>Error and warning intensity over time</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sim.timelineData}>
                  <defs>
                    <linearGradient id="errorFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="warnFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    minTickGap={28}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.hour || ""}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Area type="monotone" dataKey="warn" stroke="#f59e0b" fill="url(#warnFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="error" stroke="#f87171" fill="url(#errorFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Levels</CardTitle>
              <CardDescription>Distribution by severity</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sim.levelsChartData}>
                  <XAxis dataKey="level" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Agent management sub-panel */}
        <AgentListPanel
          agents={sim.agents}
          selectedAgent={sim.selectedAgent}
          setSelectedAgent={sim.setSelectedAgent}
          selectedAgentLabel={sim.selectedAgentLabel}
          selectedSourceLabel={sim.selectedSourceLabel}
          selectedSource={sim.selectedSource}
          setSelectedSource={sim.setSelectedSource}
          newAgentName={sim.newAgentName}
          setNewAgentName={sim.setNewAgentName}
          newAgentVpcId={sim.newAgentVpcId}
          setNewAgentVpcId={sim.setNewAgentVpcId}
          creatingAgent={sim.creatingAgent}
          createAgent={sim.createAgent}
          createdCredentials={sim.createdCredentials}
          copiedId={sim.copiedId}
          handleCopy={sim.handleCopy}
          editingAgent={sim.editingAgent}
          setEditingAgent={sim.setEditingAgent}
          isSettingsOpen={sim.isSettingsOpen}
          setIsSettingsOpen={sim.setIsSettingsOpen}
          handleUpdateAgentConfig={sim.handleUpdateAgentConfig}
          agentToDelete={sim.agentToDelete}
          setAgentToDelete={sim.setAgentToDelete}
          confirmDeleteAgent={sim.confirmDeleteAgent}
          sourceOptions={sourceOptions}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Error Signatures</CardTitle>
              <CardDescription>Use these for AI optimization root-cause hints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(sim.summary?.topErrors || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No recurring errors detected in this window.</p>
              ) : (
                sim.summary?.topErrors.map((err) => (
                  <div
                    key={err.signature}
                    role="button"
                    tabIndex={0}
                    onClick={() => sim.setSelectedTopError(err)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        sim.setSelectedTopError(err);
                      }
                    }}
                    className="border border-border rounded-lg p-3 bg-secondary/20 cursor-pointer hover:bg-secondary/35 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{err.service}</Badge>
                      <Badge variant="secondary">{err.count} hits</Badge>
                    </div>
                    <p className="text-sm mt-2 text-foreground line-clamp-2">{err.sample}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{new Date(err.lastSeenAt).toLocaleString()}</p>
                    <p className="text-[11px] text-primary mt-2">Click to view full error</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Recent Logs</CardTitle>
                  <CardDescription>Latest ingested lines across selected sources</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => sim.setShowClearLogsConfirm(true)}
                  disabled={sim.clearingLogs || sim.loading || !sim.summary?.recent?.length}
                  className="shrink-0"
                >
                  {sim.clearingLogs ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Clear Recent Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-120 overflow-auto">
              {(() => {
                const filteredLogs = (sim.summary?.recent || []).filter((row) => !isPm2Noise(row.message));
                if (filteredLogs.length === 0) {
                  return <p className="text-sm text-muted-foreground">No logs ingested yet. Create an agent script and run it in your VPS.</p>;
                }
                return filteredLogs.map((row) => (
                  <div key={row.id} className="border border-border rounded-md p-2.5 bg-background">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Badge variant="outline">{row.source}</Badge>
                      <Badge variant="outline">{row.service}</Badge>
                      <Badge
                        variant={row.level === "error" ? "destructive" : row.level === "warn" ? "secondary" : "outline"}
                      >
                        {row.level}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</span>
                    </div>
                    {renderFormattedLogEntry(row)}
                  </div>
                ));
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Selected Error details modal */}
        <Dialog open={!!sim.selectedTopError} onOpenChange={(open) => !open && sim.setSelectedTopError(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Full Error Detail</DialogTitle>
              <DialogDescription>
                {sim.selectedTopError ? `Service: ${sim.selectedTopError.service} | Hits: ${sim.selectedTopError.count}` : ""}
              </DialogDescription>
            </DialogHeader>

            {sim.selectedTopError ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Signature</p>
                  <p className="text-sm text-foreground break-all mt-1">{sim.selectedTopError.signature}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Last Seen</p>
                  <p className="text-sm text-foreground mt-1">{new Date(sim.selectedTopError.lastSeenAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Full Message</p>
                  <pre className="mt-1 bg-secondary/40 border border-border rounded-lg p-3 text-xs whitespace-pre-wrap wrap-break-word max-h-80 overflow-auto">
                    {sim.selectedTopError.sample}
                  </pre>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Delete Alarm Confirmation */}
        <Dialog open={!!sim.alarmToDelete} onOpenChange={(open) => !open && sim.setAlarmToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Alarm</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the alarm "{sim.alarmToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => sim.setAlarmToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={sim.confirmDeleteAlarm}>Delete Alarm</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clear Logs Confirmation */}
        <Dialog open={sim.showClearLogsConfirm} onOpenChange={sim.setShowClearLogsConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear Recent Logs</DialogTitle>
              <DialogDescription>
                Are you sure you want to clear recent logs for {sim.selectedAgentLabel}, {sim.selectedSourceLabel}, last {sim.timeRange}? This will remove matching hot-store records and prune S3 chunks.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => sim.setShowClearLogsConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={async () => {
                sim.setShowClearLogsConfirm(false);
                await sim.clearRecentLogs();
              }}>Clear Logs</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
