"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { authFetchJson } from "@/lib/auth-fetch";
import {
  TeamCreatedCredential,
  TeamCredentialsCard,
} from "./TeamCredentialsCard";
import { TeamEditMemberModal } from "./TeamEditMemberModal";
import { TeamInviteCard } from "./TeamInviteCard";
import { TeamMembersCard } from "./TeamMembersCard";

interface TeamTabProps {
  showConfirm: (
    title: string,
    description: string,
    type: "info" | "success" | "warning" | "danger" | "default",
    primaryLabel: string,
    onConfirm: () => void | Promise<void>
  ) => void;
  showErrorModal: (title: string, message: string) => void;
  closeConfirm: () => void;
}

export function TeamTab({
  showConfirm,
  showErrorModal,
  closeConfirm,
}: TeamTabProps) {
  const { user } = useAuth();

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "operator" | "admin">("viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [createdCredential, setCreatedCredential] =
    useState<TeamCreatedCredential | null>(null);

  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"viewer" | "operator" | "admin">("viewer");
  const [editPassword, setEditPassword] = useState("");
  const [updatingMember, setUpdatingMember] = useState(false);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<string | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    if (!user || user.permissionLevel !== "admin") return;
    setLoadingTeam(true);
    try {
      const data = await authFetchJson(
        "/api/auth/team",
        z.object({
          success: z.boolean(),
          members: z.array(
            z.object({
              _id: z.string().optional(),
              id: z.string().optional(),
              name: z.string(),
              email: z.string().nullable().optional(),
              username: z.string().nullable().optional(),
              provider: z.string(),
              permissionLevel: z.string(),
              createdAt: z.string(),
            })
          ),
        })
      );
      setTeamMembers(data.members);
    } catch (err: any) {
      console.error("Failed to fetch team members:", err);
    } finally {
      setLoadingTeam(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const handleInviteUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteUsername.trim()) {
      setInviteError("Name and username are required");
      return;
    }
    setIsInviting(true);
    setInviteError(null);
    setCreatedCredential(null);
    try {
      const data = await authFetchJson(
        "/api/auth/team",
        z.object({
          success: z.boolean(),
          user: z.object({
            id: z.string(),
            name: z.string(),
            username: z.string(),
            email: z.string().nullable().optional(),
            role: z.string(),
            tenantId: z.string(),
            tempPassword: z.string(),
          }),
        }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: inviteName,
            username: inviteUsername.toLowerCase().trim(),
            email: inviteEmail.trim() || undefined,
            role: inviteRole,
          }),
        }
      );
      setInviteName("");
      setInviteUsername("");
      setInviteEmail("");
      setInviteRole("viewer");
      setCreatedCredential({
        name: data.user.name,
        username: data.user.username,
        email: data.user.email || "",
        role: data.user.role,
        tempPassword: data.user.tempPassword,
        tenantId: data.user.tenantId,
      });
      fetchTeamMembers();
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteUser = (userIdToDelete: string) => {
    showConfirm(
      "Revoke Team Member Access",
      "Are you sure you want to revoke access for this team member? This action cannot be undone and they will lose access immediately.",
      "danger",
      "Revoke Access",
      async () => {
        setRevokingUserId(userIdToDelete);
        try {
          await authFetchJson(
            `/api/auth/team/${userIdToDelete}`,
            z.object({
              success: z.boolean(),
              message: z.string().optional(),
            }),
            {
              method: "DELETE",
            }
          );
          fetchTeamMembers();
        } catch (err: any) {
          showErrorModal(
            "Revocation Failed",
            err.message || "Failed to revoke access"
          );
        } finally {
          setRevokingUserId(null);
          closeConfirm();
        }
      }
    );
  };

  const handleDownloadCSV = () => {
    if (!createdCredential) return;
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Tenant ID,Username,Password,Name,Role,Email Address",
        `"${createdCredential.tenantId}","${createdCredential.username || ""}","${createdCredential.tempPassword || ""}","${createdCredential.name}","${createdCredential.role}","${createdCredential.email || ""}"`,
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const nameSuffix = createdCredential.username || createdCredential.email;
    link.setAttribute("download", `rabbittwatch-credentials-${nameSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenEditModal = (member: any) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email || "");
    setEditRole(member.permissionLevel as any);
    setEditPassword("");
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;
    if (!editName.trim()) {
      showErrorModal("Validation Error", "Name is required");
      return;
    }

    setUpdatingMember(true);
    try {
      const data = await authFetchJson(
        `/api/auth/team/${editingMember.id || editingMember._id}`,
        z.object({
          success: z.boolean(),
          user: z.object({
            id: z.string(),
            name: z.string(),
            username: z.string().nullable().optional(),
            email: z.string().nullable().optional(),
            role: z.string(),
            tenantId: z.string(),
            tempPassword: z.string().nullable().optional(),
          }),
        }),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            email: editEmail.trim() || undefined,
            role: editRole,
            password: editPassword.trim() || undefined,
          }),
        }
      );

      fetchTeamMembers();
      setEditingMember(null);

      if (data.user.tempPassword) {
        setCreatedCredential({
          name: data.user.name,
          username: data.user.username || "",
          email: data.user.email || "",
          tempPassword: data.user.tempPassword,
          role: data.user.role,
          tenantId: data.user.tenantId,
          type: "reset",
        });

        setTimeout(() => {
          const element = document.getElementById("credentials-card-container");
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      } else {
        showConfirm(
          "User Updated",
          "Team member details have been updated successfully.",
          "success",
          "OK",
          () => {
            closeConfirm();
          }
        );
      }
    } catch (err: any) {
      showErrorModal(
        "Update Failed",
        err.message || "Failed to update team member"
      );
    } finally {
      setUpdatingMember(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingMember) return;

    showConfirm(
      "Reset Team Member Password",
      `Are you sure you want to reset the password for ${editingMember.name}? This will generate a new temporary password and invalidate their old password immediately.`,
      "warning",
      "Reset Password",
      async () => {
        setResettingPasswordUserId(editingMember.id || editingMember._id);
        try {
          const data = await authFetchJson(
            `/api/auth/team/${editingMember.id || editingMember._id}/reset-password`,
            z.object({
              success: z.boolean(),
              user: z.object({
                id: z.string(),
                name: z.string(),
                username: z.string().nullable().optional(),
                email: z.string().nullable().optional(),
                role: z.string(),
                tenantId: z.string(),
                tempPassword: z.string(),
              }),
            }),
            {
              method: "POST",
            }
          );

          setEditingMember(null);
          setCreatedCredential({
            name: data.user.name,
            username: data.user.username || "",
            email: data.user.email || "",
            tempPassword: data.user.tempPassword,
            role: data.user.role,
            tenantId: data.user.tenantId,
            type: "reset",
          });

          setTimeout(() => {
            const element = document.getElementById("credentials-card-container");
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 100);
        } catch (err: any) {
          showErrorModal(
            "Reset Password Failed",
            err.message || "Failed to reset password"
          );
        } finally {
          setResettingPasswordUserId(null);
          closeConfirm();
        }
      }
    );
  };

  if (user?.permissionLevel !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      {createdCredential && (
        <TeamCredentialsCard
          createdCredential={createdCredential}
          handleDownloadCSV={handleDownloadCSV}
          onDismiss={() => setCreatedCredential(null)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <TeamMembersCard
          teamMembers={teamMembers}
          loadingTeam={loadingTeam}
          currentUserId={user?.id}
          revokingUserId={revokingUserId}
          handleOpenEditModal={handleOpenEditModal}
          handleDeleteUser={handleDeleteUser}
        />
        <TeamInviteCard
          inviteName={inviteName}
          inviteUsername={inviteUsername}
          inviteEmail={inviteEmail}
          inviteRole={inviteRole}
          isInviting={isInviting}
          inviteError={inviteError}
          handleInviteUser={handleInviteUser}
          setInviteName={setInviteName}
          setInviteUsername={setInviteUsername}
          setInviteEmail={setInviteEmail}
          setInviteRole={setInviteRole}
        />
      </div>

      <TeamEditMemberModal
        editingMember={editingMember}
        editName={editName}
        editEmail={editEmail}
        editRole={editRole}
        editPassword={editPassword}
        updatingMember={updatingMember}
        resettingPasswordUserId={resettingPasswordUserId}
        handleUpdateMember={handleUpdateMember}
        handleResetPassword={handleResetPassword}
        setEditingMember={setEditingMember}
        setEditName={setEditName}
        setEditEmail={setEditEmail}
        setEditRole={setEditRole}
        setEditPassword={setEditPassword}
      />
    </div>
  );
}
