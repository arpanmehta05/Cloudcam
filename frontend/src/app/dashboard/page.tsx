"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MainDashboard } from "@/modules/cloud-dashboard";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // System admins land in the admin panel instead of the customer dashboard.
  // They can still reach their profile and other pages by direct link.
  const isAdmin = !isLoading && !!user?.isSystemAdmin;
  useEffect(() => {
    if (isAdmin) router.replace("/admin");
  }, [isAdmin, router]);

  if (isAdmin) return null;
  return <MainDashboard />;
}
