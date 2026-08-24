"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@/context/AuthContext";
import { profileTabs, tabIcons } from "./shared";

type ProfileTabListProps = {
  permissionLevel?: User["permissionLevel"];
};

export function ProfileTabList({ permissionLevel }: ProfileTabListProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
      <TabsList className="flex w-full items-center justify-start gap-1 overflow-x-auto overflow-y-hidden bg-transparent p-0 scrollbar-hide">
        {profileTabs
          .filter(([value]) => {
            if (value === "team") return permissionLevel === "admin";
            return true;
          })
          .map(([value, label]) => {
            const Icon = tabIcons[value];
            return (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all text-slate-500 hover:text-slate-900 data-[state=active]:bg-slate-50 data-[state=active]:text-blue-600 dark:text-slate-400 dark:hover:text-white dark:data-[state=active]:bg-blue-900/20 dark:data-[state=active]:text-blue-300 border-none bg-transparent"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </TabsTrigger>
            );
          })}
      </TabsList>
    </div>
  );
}
