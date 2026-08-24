"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "@/icons";
import { cn } from "@/lib/utils";

interface ManualProvisionProps {
  manualType: "sp" | "principal";
  setManualType: (v: "sp" | "principal") => void;
  manualTenantId: string;
  setManualTenantId: (v: string) => void;
  manualSubId: string;
  setManualSubId: (v: string) => void;
  manualBillingAccountId: string;
  setManualBillingAccountId: (v: string) => void;
  manualClientId: string;
  setManualClientId: (v: string) => void;
  manualClientSecret: string;
  setManualClientSecret: (v: string) => void;
  manualPrincipalId: string;
  setManualPrincipalId: (v: string) => void;
  manualSaving: boolean;
  manualError: string | null;
  handleSaveManual: () => Promise<void>;
  setCurrentStep: (v: number) => void;
}

export function ManualProvision({
  manualType,
  setManualType,
  manualTenantId,
  setManualTenantId,
  manualSubId,
  setManualSubId,
  manualBillingAccountId,
  setManualBillingAccountId,
  manualClientId,
  setManualClientId,
  manualClientSecret,
  setManualClientSecret,
  manualPrincipalId,
  setManualPrincipalId,
  manualSaving,
  manualError,
  handleSaveManual,
  setCurrentStep,
}: ManualProvisionProps) {
  return (
    <Card className="border-neutral-200 bg-white">
      <CardHeader>
        <CardTitle className="text-lg">Manual Connection Settings</CardTitle>
        <CardDescription>
          Select verification type and enter your Azure credentials directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl max-w-sm mb-4">
          <button
            onClick={() => setManualType("sp")}
            className={cn(
              "flex-1 py-1 rounded-lg text-xs font-semibold transition-all",
              manualType === "sp" ? "bg-white text-neutral-900 shadow" : "text-neutral-500"
            )}
          >
            Service Principal
          </button>
          <button
            onClick={() => setManualType("principal")}
            className={cn(
              "flex-1 py-1 rounded-lg text-xs font-semibold transition-all",
              manualType === "principal" ? "bg-white text-neutral-900 shadow" : "text-neutral-500"
            )}
          >
            Principal ID Only
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="manualTenantId" className="text-xs text-neutral-600">Tenant (Directory) ID</Label>
            <Input
              id="manualTenantId"
              value={manualTenantId}
              onChange={e => setManualTenantId(e.target.value)}
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manualSubId" className="text-xs text-neutral-600">Subscription ID</Label>
            <Input
              id="manualSubId"
              value={manualSubId}
              onChange={e => setManualSubId(e.target.value)}
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="manualBillingAccountId" className="text-xs text-neutral-600">Billing Account ID (optional for Azure MCA)</Label>
            <Input
              id="manualBillingAccountId"
              value={manualBillingAccountId}
              onChange={e => setManualBillingAccountId(e.target.value)}
              placeholder="e.g. 00000000 or /providers/Microsoft.Billing/billingAccounts/00000000"
              className="text-xs font-mono"
            />
          </div>

          {manualType === "sp" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="manualClientId" className="text-xs text-neutral-600">Client (App Registration) ID</Label>
                <Input
                  id="manualClientId"
                  value={manualClientId}
                  onChange={e => setManualClientId(e.target.value)}
                  placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manualSecret" className="text-xs text-neutral-600">Client Secret Value</Label>
                <Input
                  id="manualSecret"
                  type="password"
                  value={manualClientSecret}
                  onChange={e => setManualClientSecret(e.target.value)}
                  placeholder="Service Principal Secret Value"
                  className="text-xs font-mono"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="manualPrincipalId" className="text-xs text-neutral-600">Principal (Service Principal Object) ID</Label>
              <Input
                id="manualPrincipalId"
                value={manualPrincipalId}
                onChange={e => setManualPrincipalId(e.target.value)}
                placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                className="text-xs font-mono"
              />
            </div>
          )}
        </div>

        {manualError && (
          <p className="text-xs font-medium text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {manualError}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            onClick={() => setCurrentStep(0)}
            variant="outline"
            className="text-xs"
          >
            Back
          </Button>
          <Button
            onClick={handleSaveManual}
            disabled={
              manualSaving ||
              !manualTenantId ||
              !manualSubId ||
              (manualType === "sp" ? (!manualClientId || !manualClientSecret) : !manualPrincipalId)
            }
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4"
          >
            {manualSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Validating Connection...
              </>
            ) : (
              "Verify & Save"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
