import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Clock, Loader2, Terminal } from "@/icons";
import { CloudProvider } from "@/lib/regions";
import {
  getProviderLogStreamLabel,
  getProviderLogSetupLabel,
} from "@/lib/cloud/provider-services";
import { LogEntry } from "./LogEntry";

interface LogsPanelProps {
  logs: any[];
  loading: boolean;
  hasLogs: boolean;
  selectedResource: string;
  onResourceChange: (resource: string) => void;
  serviceResources: Array<{ id: string; name: string }>;
  selectedProvider: CloudProvider;
}

export function LogsPanel({
  logs,
  loading,
  hasLogs,
  selectedResource,
  onResourceChange,
  serviceResources,
  selectedProvider,
}: LogsPanelProps) {
  return (
    <Card className="rounded-lg overflow-hidden mt-8">
      <CardHeader className="pb-4 border-b border-border/10 bg-secondary">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-3 uppercase tracking-widest leading-none">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <FileText className="h-5 w-5" />
            </div>
            Technical Console
          </CardTitle>
          <div className="flex items-center gap-4">
            {serviceResources.length > 1 && (
              <Select
                value={selectedResource || "__all__"}
                onValueChange={(val) => {
                  onResourceChange(val === "__all__" ? "" : val);
                }}
              >
                <SelectTrigger className="w-[240px] h-9 text-xs font-bold bg-muted/20 rounded-lg focus:ring-primary/20">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="All resources" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-xl">
                  <SelectItem value="__all__" className="text-xs font-bold">
                    ALL RESOURCES DISCOVERED
                  </SelectItem>
                  {serviceResources.map((r) => (
                    <SelectItem
                      key={r.id}
                      value={r.id}
                      className="text-xs font-bold"
                    >
                      {r.name.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Badge
              variant="outline"
              className="text-xs font-bold border-border/60 text-muted-foreground rounded-lg h-9 px-4"
            >
              {getProviderLogStreamLabel(selectedProvider)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="h-64 flex items-center justify-center bg-muted/50">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-40" />
          </div>
        ) : logs.length > 0 ? (
          <div className="max-h-[600px] overflow-y-auto scrollbar-hide">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/40 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-3.5 px-6 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-56">
                    Timestamp
                  </th>
                  <th className="text-left py-3.5 px-6 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-44">
                    Source
                  </th>
                  <th className="text-left py-3.5 px-6 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Telemetry Event
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25 bg-card">
                {logs.map((log: any, idx: number) => (
                  <LogEntry key={idx} log={log} idx={idx} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-24 text-center flex flex-col items-center gap-4 bg-muted/5">
            <div className="p-4 bg-muted/10 rounded-full">
              <Terminal className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground uppercase tracking-widest">
                No Telemetry Output
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[320px] mx-auto font-medium leading-relaxed italic">
                {hasLogs
                  ? "No entries detected in the current lookback window."
                  : `${getProviderLogSetupLabel(selectedProvider)} have not been initialized for this service.`}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
