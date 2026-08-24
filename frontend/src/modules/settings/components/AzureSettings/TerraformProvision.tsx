"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Copy } from "@/icons";

interface TerraformProvisionProps {
  setupDetails: any;
  copyToClipboard: (text: string, type: "cli" | "tf") => void | Promise<void>;
  copiedTf: boolean;
}

export function TerraformProvision({
  setupDetails,
  copyToClipboard,
  copiedTf,
}: TerraformProvisionProps) {
  return (
    <Card className="border-neutral-200 bg-white">
      <CardHeader>
        <CardTitle className="text-lg">Deploy via Terraform</CardTitle>
        <CardDescription>
          Add this resource definition block to your Terraform configurations and run <code>terraform apply</code> to connect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative bg-neutral-900 text-neutral-100 p-4 rounded-xl text-xs font-mono select-all overflow-x-auto max-h-72 shadow-inner border border-neutral-800">
          <button
            onClick={() => copyToClipboard(setupDetails?.terraformTemplate || "", "tf")}
            className="absolute top-2 right-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white p-1.5 rounded-lg transition-colors border border-neutral-700"
            title="Copy template"
          >
            {copiedTf ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <pre className="pr-12">{setupDetails?.terraformTemplate}</pre>
        </div>

        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-xs text-blue-800">Waiting for Terraform deployment confirmation...</span>
            <p className="text-[11px] text-blue-600">Once Terraform pings back our webhook, connection status verifies dynamically.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
