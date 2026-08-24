"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "@/icons";

export interface TeamCreatedCredential {
  name: string;
  username?: string;
  email?: string;
  role: string;
  tempPassword?: string;
  tenantId: string;
  type?: "create" | "reset";
}

interface TeamCredentialsCardProps {
  createdCredential: TeamCreatedCredential;
  handleDownloadCSV: () => void;
  onDismiss: () => void;
}

export function TeamCredentialsCard({
  createdCredential,
  handleDownloadCSV,
  onDismiss,
}: TeamCredentialsCardProps) {
  return (
    <Card
      id="credentials-card-container"
      className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-sm animate-pulse-once"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400 text-xs font-bold">
            {"\u2713"}
          </span>
          {createdCredential.type === "reset" ? "Password Reset Successfully" : "User Created Successfully"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40 p-3.5 text-xs text-yellow-800 dark:text-yellow-400 font-semibold leading-relaxed">
          {"\u26A0\uFE0F"} WARNING: The temporary password shown below will only be visible ONCE. Please download the credentials CSV file or copy the temporary password immediately.
        </div>
        <div className="grid gap-3 rounded-lg border border-emerald-100 bg-white/60 p-4 text-xs dark:border-emerald-950 dark:bg-slate-900/30">
          <div className="flex justify-between py-1 border-b border-emerald-50 dark:border-emerald-950/55">
            <span className="font-bold text-slate-500">Name:</span>
            <span className="font-bold text-slate-800 dark:text-white">{createdCredential.name}</span>
          </div>
          {createdCredential.username && (
            <div className="flex justify-between py-1 border-b border-emerald-50 dark:border-emerald-950/55">
              <span className="font-bold text-slate-500">Username:</span>
              <span className="font-bold text-slate-800 dark:text-white">{createdCredential.username}</span>
            </div>
          )}
          {createdCredential.email && (
            <div className="flex justify-between py-1 border-b border-emerald-50 dark:border-emerald-950/55">
              <span className="font-bold text-slate-500">Email:</span>
              <span className="font-bold text-slate-800 dark:text-white">{createdCredential.email}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-emerald-50 dark:border-emerald-950/55">
            <span className="font-bold text-slate-500">Role:</span>
            <span className="font-bold text-slate-800 dark:text-white uppercase">{createdCredential.role}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-emerald-50 dark:border-emerald-950/55">
            <span className="font-bold text-slate-500">Temporary Password:</span>
            <span className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
              {createdCredential.tempPassword}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="font-bold text-slate-500">Tenant ID:</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">{createdCredential.tenantId}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm"
          >
            <Download className="h-4 w-4" />
            Download Credentials CSV
          </Button>
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
