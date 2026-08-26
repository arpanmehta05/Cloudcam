"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "@/icons";
import type { AzureConnectionMeta } from "../../types";

interface AzureStatusCardProps {
  connectionMeta: AzureConnectionMeta;
  handleDisconnect: () => Promise<void>;
  isDisconnecting: boolean;
  brandName?: string;
}

export function AzureStatusCard({
  connectionMeta,
  handleDisconnect,
  isDisconnecting,
  brandName = "Cloudcam",
}: AzureStatusCardProps) {
  return (
    <Card className="border-green-200 bg-green-50/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Subscription Connected Successfully
            </CardTitle>
            <CardDescription>
              Your Azure cloud environment is actively connected to {brandName}.
            </CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            Active Connection
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm bg-white p-4 border border-neutral-100 rounded-xl">
          <div>
            <span className="text-neutral-400 block text-xs">Directory Tenant ID</span>
            <span className="font-mono text-neutral-800 break-all">{connectionMeta.tenantId || "Unavailable"}</span>
          </div>
          <div>
            <span className="text-neutral-400 block text-xs">Subscription ID</span>
            <span className="font-mono text-neutral-800 break-all">{connectionMeta.subscriptionId || "Unavailable"}</span>
          </div>
          <div className="mt-2">
            <span className="text-neutral-400 block text-xs">Integration Client ID</span>
            <span className="font-mono text-neutral-800 break-all">{connectionMeta.clientId || "Unavailable"}</span>
          </div>
          <div className="mt-2">
            <span className="text-neutral-400 block text-xs">Billing Account ID</span>
            <span className="font-mono text-neutral-800 break-all">{connectionMeta.billingAccountId || "Subscription scope"}</span>
          </div>
          <div className="mt-2">
            <span className="text-neutral-400 block text-xs">Connected At</span>
            <span className="text-neutral-800">
              {connectionMeta.connectedAt ? new Date(connectionMeta.connectedAt).toLocaleString() : "Just now"}
            </span>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Disconnecting...
              </>
            ) : (
              "Disconnect Subscription"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
