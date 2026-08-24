"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Github, Globe, Laptop, Mail, RefreshCw, ShieldCheck, User } from "@/icons";
import { formatRelativeTime } from "./shared";

interface SecurityAuditTablesProps {
  user: any;
  securityEvents: any[];
  loadingSecurityEvents: boolean;
  fetchSecurityEvents: () => void;
}

export function SecurityAuditTables({
  user,
  securityEvents,
  loadingSecurityEvents,
  fetchSecurityEvents,
}: SecurityAuditTablesProps) {
  return (
    <div className="flex flex-col gap-6 mt-6">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 py-4 px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Laptop className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                Recent Logins
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audit trail of standard and social authentication logs on your account.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!user?.recentLogins || user.recentLogins.length === 0 ? (
            <EmptyAuditState
              icon={<Laptop className="h-6 w-6" />}
              title="No login history found"
              description="We haven't recorded any login events for this account yet. Standard sessions will appear here as they occur."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30 font-bold text-slate-400 dark:border-slate-800/60 dark:bg-slate-900/5">
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Device / Browser</th>
                    <th className="px-6 py-3">Auth Provider</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                  {user.recentLogins.map((login: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <div className="flex flex-col">
                            <span className="text-slate-900 dark:text-white font-bold">
                              {login.user?.name || (login.user?.username ? login.user.username : "Admin")}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal font-medium mt-0.5">
                              {login.user?.username ? `@${login.user.username}` : login.user?.email || "Administrator"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-slate-900 dark:text-white font-bold">{login.userAgent}</span>
                      </td>
                      <td className="px-6 py-4">
                        <LoginProviderBadge provider={login.provider} />
                      </td>
                      <td className="px-6 py-4">
                        <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10.5px] font-mono text-slate-600 dark:text-slate-400">
                          {login.ip}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <TimeCell value={login.loggedAt} includeSeconds />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Security Events
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Password changes, 2FA updates, and account security operations.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSecurityEvents}
              disabled={loadingSecurityEvents}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingSecurityEvents && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSecurityEvents ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              <span className="text-xs font-bold text-slate-500">Retrieving audit events...</span>
            </div>
          ) : securityEvents.length === 0 ? (
            <EmptyAuditState
              icon={<ShieldCheck className="h-6 w-6" />}
              title="No security events found"
              description="Your security-sensitive actions will appear here once they are registered."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30 font-bold text-slate-400 dark:border-slate-800/60 dark:bg-slate-900/5">
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3">Device / Browser</th>
                    <th className="px-6 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                  {securityEvents.map((evt) => (
                    <tr key={evt._id} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                      <td className="px-6 py-4">
                        <span className={cn("inline-flex px-2 py-0.5 rounded text-[10.5px] font-bold w-fit", getSecurityEventTone(evt.action))}>
                          {getSecurityEventLabel(evt.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10.5px] font-mono text-slate-600 dark:text-slate-400">
                          {evt.ip}
                        </code>
                      </td>
                      <td className="px-6 py-4" title={evt.userAgent}>
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className="text-slate-900 dark:text-white font-bold">{parseUserAgent(evt.userAgent)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TimeCell value={evt.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyAuditState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-900/50 dark:text-slate-500 mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">{description}</p>
    </div>
  );
}

function LoginProviderBadge({ provider }: { provider: string }) {
  if (provider === "github") {
    return (
      <Badge variant="outline" className="inline-flex items-center gap-1 bg-slate-950 text-white dark:bg-slate-900 border-none text-[10px] font-bold py-0.5 px-2">
        <Github className="h-3 w-3" />
        GitHub
      </Badge>
    );
  }
  if (provider === "google") {
    return (
      <Badge variant="outline" className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none text-[10px] font-bold py-0.5 px-2">
        <Globe className="h-3 w-3" />
        Google
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-none text-[10px] font-bold py-0.5 px-2">
      <Mail className="h-3 w-3" />
      Email
    </Badge>
  );
}

function TimeCell({ value, includeSeconds = false }: { value: string; includeSeconds?: boolean }) {
  return (
    <>
      <span className="text-slate-900 dark:text-white font-bold block" title={new Date(value).toLocaleString()}>
        {formatRelativeTime(value)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">
        {new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          ...(includeSeconds ? { second: "2-digit" } : {}),
        }).format(new Date(value))}
      </span>
    </>
  );
}

function getSecurityEventTone(action: string): string {
  if (action === "password_changed") return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  if (action === "totp_setup_started") return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  if (action === "totp_setup_confirmed") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (action === "totp_removed") return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
  if (action === "deletion_scheduled") return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
  if (action === "deletion_cancelled") return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

function getSecurityEventLabel(action: string): string {
  const labels: Record<string, string> = {
    password_changed: "Password Updated",
    totp_setup_started: "2FA Setup Initiated",
    totp_setup_confirmed: "2FA Enabled",
    totp_removed: "2FA Disabled",
    deletion_scheduled: "Account Deactivated",
    deletion_cancelled: "Account Restored",
  };
  return labels[action] || action;
}

function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown Device";
  const lower = ua.toLowerCase();

  // Detect OS
  let os = "Unknown OS";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("macintosh") || lower.includes("mac os")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";

  // Detect Browser
  let browser = "Unknown Browser";
  if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("edge")) browser = "Edge";
  else if (lower.includes("opera")) browser = "Opera";

  if (browser !== "Unknown Browser" && os !== "Unknown OS") {
    return `${browser} on ${os}`;
  }
  if (browser !== "Unknown Browser") return browser;
  if (os !== "Unknown OS") return os;

  return ua.length > 30 ? ua.substring(0, 30) + "..." : ua;
}
