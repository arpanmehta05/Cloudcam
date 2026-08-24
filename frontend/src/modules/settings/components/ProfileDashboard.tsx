"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { profileTabs } from "./ProfileDashboard/shared";
import type { ConfirmModalState, ErrorModalState, ShowConfirm } from "./ProfileDashboard/types";
import { ProfileHeader } from "./ProfileDashboard/ProfileHeader";
import { ProfileTabList } from "./ProfileDashboard/ProfileTabList";
import { ProfileDashboardModals } from "./ProfileDashboard/ProfileDashboardModals";
import { AccountTab } from "./ProfileDashboard/AccountTab";
import { SecurityTab } from "./ProfileDashboard/SecurityTab";
import { PreferencesTab } from "./ProfileDashboard/PreferencesTab";
import { IntegrationsTab } from "./ProfileDashboard/IntegrationsTab";
import { BillingTab } from "./ProfileDashboard/BillingTab";
import { TeamTab } from "./ProfileDashboard/TeamTab";
import { ActivityTab } from "./ProfileDashboard/ActivityTab";
import { DangerZoneTab } from "./ProfileDashboard/DangerZoneTab";

export function ProfileDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: "",
    description: "",
    type: "default",
    primaryLabel: "Confirm",
    onConfirm: () => {},
  });
  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    isOpen: false,
    title: "",
    message: "",
  });

  const showConfirm: ShowConfirm = (title, description, type, primaryLabel, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      type,
      primaryLabel,
      onConfirm,
    });
  };

  const showErrorModal = (title: string, message: string) => {
    setErrorModal({
      isOpen: true,
      title,
      message,
    });
  };

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const closeError = () => {
    setErrorModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.pushState({}, "", url.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && profileTabs.some(([val]) => val === tabParam)) {
        if (tabParam === "team" && user?.permissionLevel !== "admin") {
          setActiveTab("account");
        } else {
          setActiveTab(tabParam);
        }
      } else {
        setActiveTab("account");
      }
    };

    window.addEventListener("popstate", handlePopState);
    handlePopState(); // initial run

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [user?.permissionLevel]);

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <div className="space-y-6">
      <ProfileHeader user={user} onLogout={handleLogout} />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <ProfileTabList permissionLevel={user?.permissionLevel} />

        <TabsContent value="account">
          <AccountTab handleTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab
            showConfirm={showConfirm}
            showErrorModal={showErrorModal}
            closeConfirm={closeConfirm}
          />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab
            showConfirm={showConfirm}
            showErrorModal={showErrorModal}
            closeConfirm={closeConfirm}
          />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab
            showConfirm={showConfirm}
            showErrorModal={showErrorModal}
            closeConfirm={closeConfirm}
          />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab />
        </TabsContent>
        <TabsContent value="danger">
          <DangerZoneTab
            showConfirm={showConfirm}
            showErrorModal={showErrorModal}
            closeConfirm={closeConfirm}
          />
        </TabsContent>
      </Tabs>

      <ProfileDashboardModals
        confirmModal={confirmModal}
        errorModal={errorModal}
        closeConfirm={closeConfirm}
        closeError={closeError}
      />
    </div>
  );
}
