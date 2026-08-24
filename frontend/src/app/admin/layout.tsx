"use client";

import { useAuth } from "@/context/AuthContext";
import { notFound } from "next/navigation";
import { Loader2 } from "@/icons";
import { AdminShell } from "@/modules/admin/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Shield: anyone who is not a system admin gets a standard 404 — the panel's
  // existence is never revealed. The backend enforces the same rule (+ 2FA).
  if (!user || !user.isSystemAdmin) {
    notFound();
  }

  return <AdminShell>{children}</AdminShell>;
}
