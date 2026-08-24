"use client";

import { z } from "zod";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Cloud,
  Laptop,
  Lock,
  ShieldCheck,
  User,
  Wallet,
} from "@/icons";

export const ProfileEnvelopeSchema = z.object({
  success: z.boolean(),
  user: z.object({}).passthrough(),
});

export const MessageEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  notificationSent: z.boolean().optional(),
});

export const TotpSetupEnvelopeSchema = z.object({
  success: z.boolean(),
  secret: z.string(),
  otpauthUrl: z.string(),
  qrCodeDataUrl: z.string(),
});

export const NotificationSettingsEnvelopeSchema = z.object({
  success: z.boolean(),
  settings: z.object({
    slack: z.object({
      enabled: z.boolean(),
      connected: z.boolean(),
      connectedAt: z.string().nullable(),
      lastFour: z.string().nullable(),
      botConnected: z.boolean().optional(),
      secretConnected: z.boolean().optional(),
    }),
    email: z.object({
      enabled: z.boolean(),
    }),
  }),
});

export const IntegrationsEnvelopeSchema = z.object({
  success: z.boolean(),
  integrations: z.object({
    aiKeys: z.object({
      openai: z.object({
        connected: z.boolean(),
        connectedAt: z.string().nullable(),
        lastFour: z.string().nullable(),
      }),
      anthropic: z.object({
        connected: z.boolean(),
        connectedAt: z.string().nullable(),
        lastFour: z.string().nullable(),
      }),
      gemini: z.object({
        connected: z.boolean(),
        connectedAt: z.string().nullable(),
        lastFour: z.string().nullable(),
      }),
    }),
    cloud: z.object({
      aws: z.object({
        connected: z.boolean(),
        connectedAt: z.string().nullable(),
        status: z.string(),
        roleArn: z.string().nullable(),
      }),
      azure: z.object({
        connected: z.boolean(),
        connectedAt: z.string().nullable(),
        status: z.string(),
        subscriptionId: z.string().nullable(),
        authMode: z.string().nullable(),
      }),
      gcp: z.object({
        connected: z.boolean(),
        connectedAt: z.string().nullable(),
        status: z.string(),
        projectId: z.string().nullable(),
        clientEmail: z.string().nullable(),
      }),
    }),
    github: z.object({
      connected: z.boolean(),
      connectedAt: z.string().nullable(),
    }),
  }),
});

export const profileTabs = [
  ["account", "Account"],
  ["security", "Security"],
  ["preferences", "Preferences"],
  ["integrations", "Integrations"],
  ["billing", "Billing"],
  ["team", "Team Management"],
  ["activity", "Activity"],
  ["danger", "Danger Zone"],
] as const;

export const tabIcons: Record<string, typeof User> = {
  account: User,
  security: ShieldCheck,
  preferences: Bell,
  integrations: Cloud,
  billing: Wallet,
  team: User,
  activity: Laptop,
  danger: Lock,
};

export function initials(name?: string | null) {
  return (name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function statusBadge(status: "live" | "soon") {
  return status === "soon" ? (
    <Badge
      variant="outline"
      className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-950 dark:bg-orange-950/20 dark:text-orange-400"
    >
      Coming soon
    </Badge>
  ) : null;
}

export function SettingRow({
  icon: Icon,
  title,
  body,
  status,
  compact = false,
  href,
  onClick,
}: {
  icon: any;
  title: string;
  body: React.ReactNode;
  status: "live" | "soon";
  compact?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const interactiveClassName =
    href || onClick
      ? "cursor-pointer transition duration-200 hover:border-blue-300 hover:bg-blue-50/20 dark:hover:border-blue-800 dark:hover:bg-blue-950/10"
      : "";

  if (compact) {
    const content = (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-bold text-slate-800 dark:text-white">
                {title}
              </span>
            </span>
            <span className="mt-1 block overflow-hidden text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {body}
            </span>
          </span>
        </div>
        {status === "soon" ? (
          <span className="shrink-0">{statusBadge(status)}</span>
        ) : null}
      </>
    );
    const className = `flex min-h-[74px] items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/50 dark:bg-slate-900/10 ${interactiveClassName}`;

    if (href) {
      return (
        <Link href={href} className={className}>
          {content}
        </Link>
      );
    }
    if (onClick) {
      return (
        <div onClick={onClick} className={className}>
          {content}
        </div>
      );
    }
    return <div className={className}>{content}</div>;
  }

  const content = (
    <>
      <div className="flex min-w-0 gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-800 dark:text-white">
            {title}
          </span>
          <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
            {body}
          </span>
        </span>
      </div>
      {status === "soon" ? statusBadge(status) : null}
    </>
  );
  const className = `flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30 ${interactiveClassName}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <div onClick={onClick} className={className}>
        {content}
      </div>
    );
  }
  return <div className={className}>{content}</div>;
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3.5 last:border-b-0 dark:border-slate-800/60">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="max-w-[190px] break-words text-right text-sm font-bold text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}
