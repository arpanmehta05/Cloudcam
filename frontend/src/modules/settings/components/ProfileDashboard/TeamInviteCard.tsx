"use client";

import { FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "@/icons";

interface TeamInviteCardProps {
  inviteName: string;
  inviteUsername: string;
  inviteEmail: string;
  inviteRole: "viewer" | "operator" | "admin";
  isInviting: boolean;
  inviteError: string | null;
  handleInviteUser: (event: FormEvent) => void;
  setInviteName: (value: string) => void;
  setInviteUsername: (value: string) => void;
  setInviteEmail: (value: string) => void;
  setInviteRole: (value: "viewer" | "operator" | "admin") => void;
}

export function TeamInviteCard({
  inviteName,
  inviteUsername,
  inviteEmail,
  inviteRole,
  isInviting,
  inviteError,
  handleInviteUser,
  setInviteName,
  setInviteUsername,
  setInviteEmail,
  setInviteRole,
}: TeamInviteCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm h-fit">
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
          Create Team User
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInviteUser} className="space-y-4">
          {inviteError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3 text-xs font-semibold text-red-700 dark:text-red-400">
              {inviteError}
            </div>
          )}
          <div className="space-y-1.5">
            <Label
              htmlFor="invite-name"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Name
            </Label>
            <Input
              id="invite-name"
              placeholder="John Doe"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
              className="h-10 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="invite-username"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Username
            </Label>
            <Input
              id="invite-username"
              placeholder="alex.ops"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              required
              className="h-10 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="invite-email"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Email Address (Optional)
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="john@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-10 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="invite-role"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Role
            </Label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "viewer" | "operator" | "admin")
              }
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="operator">Operator (Actions & Simulations)</option>
              <option value="admin">Admin (Full Control)</option>
            </select>
          </div>
          <Button
            type="submit"
            disabled={isInviting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm"
          >
            {isInviting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Invite Team User
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
