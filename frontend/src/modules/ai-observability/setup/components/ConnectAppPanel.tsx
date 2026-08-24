"use client";

import { useMemo, useState } from "react";
import { Clipboard, Plug } from "@/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { SetupCodeBlock } from "./SetupCodeBlock";
import {
  getQuickstartText,
  getSetupSnippet,
  setupSnippetOptions,
  type SetupSnippetId,
} from "../utils/setupSnippets";

type ConnectAppPanelProps = {
  ingestKey: string;
  endpoint: string;
  service: string;
  environment: string;
};

export function ConnectAppPanel({
  ingestKey,
  endpoint,
  service,
  environment,
}: ConnectAppPanelProps) {
  const [selectedId, setSelectedId] = useState<SetupSnippetId>("python-sdk");
  const snippet = useMemo(
    () =>
      getSetupSnippet(selectedId, {
        key: ingestKey,
        endpoint,
        service,
        environment,
      }),
    [endpoint, environment, ingestKey, selectedId, service]
  );

  const dropdownOptions = useMemo(
    () =>
      setupSnippetOptions.map((option) => ({
        value: option.id,
        label: option.label,
        description: option.description,
      })),
    []
  );

  return (
    <Card className="rounded-xl border border-slate-200/80 shadow-md dark:border-slate-800/80 overflow-hidden bg-card transition-all hover:shadow-lg">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Plug className="h-5 w-5 text-indigo-500" />
              Connect Your App
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Select your favorite SDK or framework integration to view a fully configured setup guide.
            </CardDescription>
          </div>
          <div className="w-full md:w-[320px] shrink-0">
            <CustomDropdown
              options={dropdownOptions}
              value={selectedId}
              onChange={(value) => setSelectedId(value as SetupSnippetId)}
              searchable={false}
              placeholder="Select framework..."
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Install Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                1. Install Dependency
              </p>
            </div>
            <SetupCodeBlock value={snippet.install} />
          </div>

          {/* Environment Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                2. Environment Variables
              </p>
            </div>
            <SetupCodeBlock value={snippet.env} />
          </div>
        </div>

        {/* Instrumentation Section */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                3. Code Instrumentation
              </p>
              <p className="text-xs text-muted-foreground">
                Copy and integrate this working code snippet directly into your application.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(getQuickstartText(snippet))
              }
              className="w-full sm:w-auto h-9 font-semibold text-xs border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-indigo-900/50 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 cursor-pointer shrink-0 transition-colors"
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Copy All Steps
            </Button>
          </div>
          <SetupCodeBlock value={snippet.code} />
        </div>
      </CardContent>
    </Card>
  );
}
