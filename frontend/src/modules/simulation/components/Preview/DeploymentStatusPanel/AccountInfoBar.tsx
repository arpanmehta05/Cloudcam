"use client";

import { User } from "@/icons";

interface AccountInfoBarProps {
  provider: "aws" | "azure" | "gcp";
  accountInfo: {
    accountId: string;
  } | null;
  formRegion: string;
  maskId: (id: string) => string;
}

export function AccountInfoBar({
  provider,
  accountInfo,
  formRegion,
  maskId,
}: AccountInfoBarProps) {
  if (!accountInfo) return null;

  const providerLabel =
    provider === "azure"
      ? "Azure Subscription Verified"
      : provider === "gcp"
        ? "GCP Project Verified"
        : "AWS Account Verified";
  const identityLabel =
    provider === "azure"
      ? "Subscription ID:"
      : provider === "gcp"
        ? "Project ID:"
        : "Account ID:";

  return (
    <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <User className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
          {providerLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] select-text">
        <div>
          <span className="text-muted-foreground">{identityLabel}</span>
          <span className="ml-1 text-foreground font-semibold font-mono">
            {maskId(accountInfo.accountId)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Region:</span>
          <span className="ml-1 text-foreground font-semibold">
            {formRegion}
          </span>
        </div>
      </div>
    </div>
  );
}
