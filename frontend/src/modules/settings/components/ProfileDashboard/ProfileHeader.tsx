"use client";

import { useMemo } from "react";
import { LogOut } from "@/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { User } from "@/context/AuthContext";
import { initials } from "./shared";

type ProfileHeaderProps = {
  user: User | null;
  onLogout: () => void;
};

export function ProfileHeader({ user, onLogout }: ProfileHeaderProps) {
  const authProvider = user?.provider || "email";
  const joinedAt = useMemo(() => {
    if (!user?.createdAt) return "Coming soon";
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(user.createdAt));
  }, [user?.createdAt]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="relative">
            <Avatar className="h-20 w-20 ring-4 ring-blue-500/10 dark:ring-blue-500/20">
              {user?.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user?.name || "Profile"} />
              ) : null}
              <AvatarFallback className="bg-slate-950 text-2xl font-black text-white dark:bg-blue-600">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-1 right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-green-500 dark:border-slate-950">
              <span className="h-2 w-2 animate-ping rounded-full bg-white opacity-75" />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {user?.name || "Profile"}
              </h1>
              <Badge
                variant="secondary"
                className="capitalize text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-none"
              >
                {authProvider}
              </Badge>
            </div>
            {user?.username ? (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                {user.username} <span className="text-slate-300 dark:text-slate-700">|</span> Tenant: {user.tenantId}
              </p>
            ) : (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                {user?.email}
              </p>
            )}
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2 text-xs font-semibold">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {user?.permissionLevel || "operator"} access
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Joined {joinedAt}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onLogout}
          className="self-center lg:self-auto gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}
