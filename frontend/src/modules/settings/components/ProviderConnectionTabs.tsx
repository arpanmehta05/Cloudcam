"use client";

import { cn } from "@/lib/utils";

type ProviderKey = "aws" | "azure" | "gcp";

const PROVIDER_TABS: Array<{ key: ProviderKey; label: string; href: string }> = [
  { key: "aws", label: "AWS Connection", href: "/settings/aws" },
  { key: "azure", label: "Azure Connection", href: "/settings/azure" },
  { key: "gcp", label: "GCP Connection", href: "/settings/gcp" },
];

type ProviderConnectionTabsProps = {
  activeProvider: ProviderKey;
};

export function ProviderConnectionTabs({ activeProvider }: ProviderConnectionTabsProps) {
  return (
    <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6">
      {PROVIDER_TABS.map((tab) => {
        const isActive = tab.key === activeProvider;
        const className = cn(
          "px-5 py-3 border-b-2 text-sm",
          isActive
            ? "border-blue-600 font-semibold text-blue-600 dark:text-blue-500"
            : "border-transparent hover:border-neutral-300 font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        );

        if (isActive) {
          return (
            <button key={tab.key} className={className}>
              {tab.label}
            </button>
          );
        }

        return (
          <a key={tab.key} href={tab.href} className={className}>
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
