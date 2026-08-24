import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, Info, Plus, Shield, Loader2 } from "@/icons";
import { CloudProvider } from "@/lib/regions";
import { getProviderAlarmLabel } from "@/lib/cloud/provider-services";
import { AlarmRow } from "./AlarmRow";

interface AlarmsPanelProps {
  alarms: any;
  loading: boolean;
  processingAlarms: Record<string, "deleting" | "toggling">;
  selectedProvider: CloudProvider;
  onToggleAlarm: (alarm: any, enabled: boolean) => void;
  onEditAlarm: (alarm: any) => void;
  onDeleteAlarm: (region: string, name: string) => void;
  onCreateAlarm: () => void;
  onProvisionBestPractices: () => void;
}

export function AlarmsPanel({
  alarms,
  loading,
  processingAlarms,
  selectedProvider,
  onToggleAlarm,
  onEditAlarm,
  onDeleteAlarm,
  onCreateAlarm,
  onProvisionBestPractices,
}: AlarmsPanelProps) {
  const tableHeaders = (
    <thead className="bg-muted/10 border-b border-border">
      <tr>
        <th className="text-left py-3 px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/80">
          Alarm Context
        </th>
        <th className="text-left py-3 px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/80">
          Status
        </th>
        <th className="text-left py-3 px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/80">
          Namespace
        </th>
        <th className="text-left py-3 px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/80">
          Metric
        </th>
        <th className="text-left py-3 px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/80">
          Reason
        </th>
        <th className="text-right py-3 px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground/80">
          Actions
        </th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4">
      {/* Summary Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 border-destructive/10 bg-destructive/[0.03] dark:border-destructive/20 dark:bg-destructive/[0.05] relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg hover:border-destructive/30 transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Bell className="w-20 h-20 text-destructive" />
          </div>
          <p className="text-[10px] text-destructive font-bold uppercase tracking-[0.15em] mb-3">
            In Alarm
          </p>
          {loading && !alarms ? (
            <div className="h-10 w-16 bg-destructive/10 animate-pulse rounded-md mt-1" />
          ) : (
            <p className="text-5xl font-bold tracking-tight text-destructive">
              {alarms?.counts?.alarm ?? 0}
            </p>
          )}
          <p className="text-xs text-destructive/60 font-bold mt-2 uppercase tracking-tight">
            Requires immediate attention
          </p>
        </Card>

        <Card className="p-6 border-emerald-500/10 bg-emerald-500/[0.03] dark:border-emerald-500/20 dark:bg-emerald-500/[0.05] relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg hover:border-emerald-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle2 className="w-20 h-20 text-emerald-500" />
          </div>
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-[0.15em] mb-3">
            Healthy State
          </p>
          {loading && !alarms ? (
            <div className="h-10 w-16 bg-emerald-500/10 animate-pulse rounded-md mt-1" />
          ) : (
            <p className="text-5xl font-bold tracking-tight text-emerald-500">
              {alarms?.counts?.ok ?? 0}
            </p>
          )}
          <p className="text-xs text-emerald-500/60 font-bold mt-2 uppercase tracking-tight">
            Operating within margins
          </p>
        </Card>

        <Card className="p-6 border-border bg-muted/30 dark:bg-muted/10 relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg hover:border-muted-foreground/25 transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Info className="w-20 h-20 text-muted-foreground" />
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em] mb-3">
            Insufficient Data
          </p>
          {loading && !alarms ? (
            <div className="h-10 w-16 bg-muted/20 animate-pulse rounded-md mt-1" />
          ) : (
            <p className="text-5xl font-bold tracking-tight text-foreground">
              {alarms?.counts?.insufficient ?? 0}
            </p>
          )}
          <p className="text-xs text-muted-foreground/60 font-bold mt-2 uppercase tracking-tight">
            Pending telemetry
          </p>
        </Card>
      </div>

      {/* Alarms Table */}
      <Card className="rounded-2xl overflow-hidden border border-border bg-card mt-8">
        <CardHeader className="pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-xs font-bold flex items-center gap-3 uppercase tracking-widest leading-none text-foreground">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Bell className="h-5 w-5" />
              </div>
              {getProviderAlarmLabel(selectedProvider)}
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 rounded-xl h-9 px-4 flex items-center gap-2 transition-all"
                onClick={onCreateAlarm}
                disabled={loading && !alarms}
              >
                <Plus className="w-3.5 h-3.5" />
                CUSTOM ALARM
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 rounded-xl h-9 px-4 flex items-center gap-2 transition-all"
                onClick={onProvisionBestPractices}
                disabled={loading && !alarms}
              >
                <Shield className="w-3.5 h-3.5" />
                PROVISION BEST PRACTICES
              </Button>
              {loading && !alarms ? (
                <div className="h-9 w-28 bg-muted/20 animate-pulse rounded-xl" />
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-border text-muted-foreground rounded-xl h-9 px-3"
                >
                  {alarms?.counts?.total ?? 0} Total Fleet
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !alarms ? (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                {tableHeaders}
                <tbody className="divide-y divide-border/5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-6">
                        <div className="h-4 w-36 bg-muted/20 rounded mb-2" />
                        <div className="h-3 w-16 bg-muted/20 rounded" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-7 w-20 bg-muted/20 rounded-full" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 w-24 bg-muted/20 rounded" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 w-28 bg-muted/20 rounded" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-3 w-48 bg-muted/20 rounded" />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="h-8 w-24 bg-muted/20 rounded ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : alarms?.alarms?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                {tableHeaders}
                <tbody className="divide-y divide-border/5">
                  {alarms.alarms.map((alarm: any, idx: number) => {
                    const key = `${alarm.name}_${alarm.region}`;
                    return (
                      <AlarmRow
                        key={idx}
                        alarm={alarm}
                        idx={idx}
                        processingStatus={processingAlarms[key]}
                        onToggle={(enabled) => onToggleAlarm(alarm, enabled)}
                        onEdit={() => onEditAlarm(alarm)}
                        onDelete={() => onDeleteAlarm(alarm.region, alarm.name)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4 bg-muted/5">
              <div className="p-4 bg-muted/20 rounded-full">
                <Bell className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground uppercase tracking-widest">
                  No Active Alarms
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto font-medium">
                  Your fleet is currently operating within all defined metric boundaries.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/20 text-primary hover:bg-primary/5 font-bold rounded-xl"
                  onClick={onCreateAlarm}
                >
                  Configure First Alarm
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
                  onClick={onProvisionBestPractices}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Setup Default Alarms
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
