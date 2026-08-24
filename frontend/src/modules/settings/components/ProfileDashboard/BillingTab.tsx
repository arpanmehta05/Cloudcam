"use client";

import { Wallet, Cloud, Mail } from "@/icons";
import { SettingRow } from "./shared";

export function BillingTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <SettingRow
        icon={Wallet}
        title="Current plan"
        body="Plan name, limits, and renewal date can live here once billing is connected."
        status="soon"
      />
      <SettingRow
        icon={Cloud}
        title="Usage limits"
        body="Track monitored resources, AI events, simulations, and report volume."
        status="soon"
      />
      <SettingRow
        icon={Mail}
        title="Invoices"
        body="Download invoices and manage billing email recipients."
        status="soon"
      />
    </div>
  );
}
