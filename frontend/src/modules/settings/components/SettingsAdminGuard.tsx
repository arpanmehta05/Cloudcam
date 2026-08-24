"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

type SettingsAdminGuardProps = {
  children: ReactNode;
  deniedMessage: string;
};

export function SettingsAdminGuard({ children, deniedMessage }: SettingsAdminGuardProps) {
  const { user } = useAuth();

  if (user && user.permissionLevel !== "admin") {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center space-y-6 bg-white dark:bg-[#07111F] rounded-2xl border border-[#E2E8F0] dark:border-[#24344D] shadow-xl mt-10">
        <h1 className="text-3xl font-extrabold text-red-600 dark:text-red-400">Access Denied</h1>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto font-semibold">{deniedMessage}</p>
        <Button onClick={() => window.location.href = "/"} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg">Go to Dashboard</Button>
      </div>
    );
  }

  return <>{children}</>;
}
