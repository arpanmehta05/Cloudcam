"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ExternalLink, Check, Copy, Terminal } from "@/icons";

interface CliProvisionProps {
  setupDetails: any;
  copyToClipboard: (text: string, type: "cli" | "tf") => void | Promise<void>;
  copiedCli: boolean;
}

export function CliProvision({
  setupDetails,
  copyToClipboard,
  copiedCli,
}: CliProvisionProps) {
  return (
    <Card className="border-neutral-200 bg-white">
      <CardHeader>
        <CardTitle className="text-lg">Deploy via Azure Cloud Shell</CardTitle>
        <CardDescription>
          This command automatically registers an Active Directory App, assigns subscription Reader permissions, and connects to your CloudWatcher dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-600">Instructions:</p>
          <ol className="list-decimal pl-5 text-xs text-neutral-500 space-y-1.5">
            <li>
              Open the{" "}
              <a
                href="https://shell.azure.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
              >
                Azure Cloud Shell <ExternalLink className="w-2.5 h-2.5 inline" />
              </a>{" "}
              and set the environment to **Bash**.
            </li>
            <li>Copy and paste the command block below.</li>
            <li>Execute. The script will automatically ping back and connect once complete.</li>
          </ol>
        </div>

        <div className="relative bg-neutral-900 text-neutral-100 p-4 rounded-xl text-xs font-mono select-all overflow-x-auto max-h-72 shadow-inner border border-neutral-800">
          <button
            onClick={() => copyToClipboard(setupDetails?.cloudShellScript || "", "cli")}
            className="absolute top-2 right-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white p-1.5 rounded-lg transition-colors border border-neutral-700"
            title="Copy command"
          >
            {copiedCli ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <pre className="pr-12">{setupDetails?.cloudShellScript}</pre>
        </div>

        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-xs text-blue-800">Waiting for webhook callbacks...</span>
            <p className="text-[11px] text-blue-600">Once the CLI command completes, this screen will automatically transition to success.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
