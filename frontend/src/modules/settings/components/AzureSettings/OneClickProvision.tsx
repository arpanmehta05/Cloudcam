"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CloudIcon, Loader2, ExternalLink, Download, AlertCircle } from "@/icons";

interface OneClickProvisionProps {
  oneClickTenantId: string;
  setOneClickTenantId: (v: string) => void;
  oneClickSubId: string;
  setOneClickSubId: (v: string) => void;
  oneClickPrincipalId: string;
  setOneClickPrincipalId: (v: string) => void;
  oneClickEnableLogAnalytics: boolean;
  setOneClickEnableLogAnalytics: (v: boolean) => void;
  deployUrl: string;
  setDeployUrl: (v: string) => void;
  generatingLink: boolean;
  handleGenerateDeployUrl: () => Promise<void>;
  handleDownloadTemplate: () => Promise<void>;
  downloadingTemplate: boolean;
  setupDetails: any;
  user: any;
  isPolling: boolean;
}

export function OneClickProvision({
  oneClickTenantId,
  setOneClickTenantId,
  oneClickSubId,
  setOneClickSubId,
  oneClickPrincipalId,
  setOneClickPrincipalId,
  oneClickEnableLogAnalytics,
  setOneClickEnableLogAnalytics,
  deployUrl,
  setDeployUrl,
  generatingLink,
  handleGenerateDeployUrl,
  handleDownloadTemplate,
  downloadingTemplate,
  setupDetails,
  user,
  isPolling,
}: OneClickProvisionProps) {
  return (
    <Card className="border-neutral-200 bg-white">
      <CardHeader>
        <CardTitle className="text-lg">Deploy via Azure ARM Template (Recommended)</CardTitle>
        <CardDescription>
          Deploy the integration infrastructure directly into your subscription with a single click. This registers the required Reader permissions and starts log forwarding automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="oneClickTenantId" className="text-xs text-neutral-600">Tenant (Directory) ID</Label>
            <Input
              id="oneClickTenantId"
              value={oneClickTenantId}
              onChange={e => {
                setOneClickTenantId(e.target.value);
                setDeployUrl("");
              }}
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oneClickSubId" className="text-xs text-neutral-600">Subscription ID</Label>
            <Input
              id="oneClickSubId"
              value={oneClickSubId}
              onChange={e => {
                setOneClickSubId(e.target.value);
                setDeployUrl("");
              }}
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="oneClickPrincipalId" className="text-xs text-neutral-600">
                Principal (Service Principal Object) ID
              </Label>
              <span className="text-[10px] text-neutral-400">
                Object ID of the Service Principal
              </span>
            </div>
            <Input
              id="oneClickPrincipalId"
              value={oneClickPrincipalId}
              onChange={e => {
                setOneClickPrincipalId(e.target.value);
                setDeployUrl("");
              }}
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              className="text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <input
            type="checkbox"
            id="oneClickEnableLogAnalytics"
            checked={oneClickEnableLogAnalytics}
            onChange={e => {
              setOneClickEnableLogAnalytics(e.target.checked);
              setDeployUrl("");
            }}
            className="rounded text-blue-600 border-neutral-300 focus:ring-blue-500 h-4 w-4"
          />
          <Label htmlFor="oneClickEnableLogAnalytics" className="text-xs text-neutral-600 cursor-pointer">
            Provision Log Analytics workspace for metrics/log forwarding
          </Label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={handleGenerateDeployUrl}
            disabled={generatingLink || !oneClickTenantId || !oneClickSubId || !oneClickPrincipalId}
            className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs px-4"
          >
            {generatingLink ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating Link...</>
            ) : (
              "Generate Onboarding Link"
            )}
          </Button>

          {deployUrl && (
            <div className="w-full space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#0078d4] hover:bg-[#006cc1] shadow transition-all"
                >
                  <CloudIcon className="w-4 h-4" />
                  Deploy to Azure
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="text-xs border-neutral-200 hover:bg-neutral-50 px-4 py-2.5"
                >
                  {downloadingTemplate ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Downloading...</>
                  ) : (
                    <><Download className="w-3.5 h-3.5 mr-1.5" />Download ARM Template</>
                  )}
                </Button>
              </div>

              <div className="bg-amber-50/40 border border-amber-200/70 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Encountered a Portal Fetching Error?
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  If the Azure portal shows a template loading error, use the manual template editor workaround:
                </p>
                <ol className="list-decimal pl-4 text-[11px] text-amber-700 space-y-1">
                  <li>Click <strong>Download ARM Template</strong> above to save the template file locally.</li>
                  <li>In the Azure Portal page, click on <strong>Build your own template in the editor</strong>.</li>
                  <li>Click <strong>Load file</strong>, select the downloaded <code>azure-onboarding.json</code>, and click <strong>Save</strong>.</li>
                  <li>Fill in the parameters shown below and click deploy.</li>
                </ol>

                <div className="mt-3 p-3 bg-white/80 rounded-lg border border-amber-100/50 space-y-2 text-[11px]">
                  <span className="font-semibold text-neutral-700">ARM Parameters copy helper:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-neutral-600">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-400">workspaceId:</span>
                      <div className="flex items-center justify-between gap-2 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100 mt-0.5">
                        <span className="truncate">{user?.id || "loading..."}</span>
                        <button onClick={() => { navigator.clipboard.writeText(user?.id || ""); }} className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] cursor-pointer">Copy</button>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-400">tenantId:</span>
                      <div className="flex items-center justify-between gap-2 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100 mt-0.5">
                        <span className="truncate">{oneClickTenantId}</span>
                        <button onClick={() => { navigator.clipboard.writeText(oneClickTenantId); }} className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] cursor-pointer">Copy</button>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-400">subscriptionId:</span>
                      <div className="flex items-center justify-between gap-2 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100 mt-0.5">
                        <span className="truncate">{oneClickSubId}</span>
                        <button onClick={() => { navigator.clipboard.writeText(oneClickSubId); }} className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] cursor-pointer">Copy</button>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-400">principalId:</span>
                      <div className="flex items-center justify-between gap-2 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100 mt-0.5">
                        <span className="truncate">{oneClickPrincipalId}</span>
                        <button onClick={() => { navigator.clipboard.writeText(oneClickPrincipalId); }} className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] cursor-pointer">Copy</button>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-400">webhookUrl:</span>
                      <div className="flex items-center justify-between gap-2 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100 mt-0.5">
                        <span className="truncate">{setupDetails?.webhookUrl || "loading..."}</span>
                        <button onClick={() => { navigator.clipboard.writeText(setupDetails?.webhookUrl || ""); }} className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] cursor-pointer">Copy</button>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-400">webhookSecret:</span>
                      <div className="flex items-center justify-between gap-2 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100 mt-0.5">
                        <span className="truncate">{setupDetails?.webhookSecret ? "configured secret" : "loading..."}</span>
                        <button onClick={() => { navigator.clipboard.writeText(setupDetails?.webhookSecret || ""); }} className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] cursor-pointer">Copy</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isPolling && (
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3 mt-4">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-xs text-blue-800">Waiting for webhook callback...</span>
              <p className="text-[11px] text-blue-600">Once the deployment script pingback is received, your connection will confirm dynamically.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
