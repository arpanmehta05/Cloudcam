"use client";

import { Button } from "@/components/ui/button";
import { DynamicModal } from "@/components/ui/DynamicModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

interface TeamEditMemberModalProps {
  editingMember: any | null;
  editName: string;
  editEmail: string;
  editRole: "viewer" | "operator" | "admin";
  editPassword: string;
  updatingMember: boolean;
  resettingPasswordUserId: string | null;
  handleUpdateMember: () => void;
  handleResetPassword: () => void;
  setEditingMember: (member: any | null) => void;
  setEditName: (value: string) => void;
  setEditEmail: (value: string) => void;
  setEditRole: (value: "viewer" | "operator" | "admin") => void;
  setEditPassword: (value: string) => void;
}

export function TeamEditMemberModal({
  editingMember,
  editName,
  editEmail,
  editRole,
  editPassword,
  updatingMember,
  resettingPasswordUserId,
  handleUpdateMember,
  handleResetPassword,
  setEditingMember,
  setEditName,
  setEditEmail,
  setEditRole,
  setEditPassword,
}: TeamEditMemberModalProps) {
  return (
    <DynamicModal
      isOpen={!!editingMember}
      onClose={() => setEditingMember(null)}
      title="Edit Team Member"
      description={`Modify permissions or reset access credentials for @${editingMember?.username || editingMember?.email || ""}`}
      type="default"
      size="md"
      primaryAction={{
        label: updatingMember ? "Saving..." : "Save Changes",
        onClick: handleUpdateMember,
        isLoading: updatingMember,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: () => setEditingMember(null),
      }}
    >
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="edit-name"
            className="text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            Name
          </Label>
          <Input
            id="edit-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="edit-email"
            className="text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            Email Address (Optional)
          </Label>
          <Input
            id="edit-email"
            type="email"
            placeholder="Optional: notifications/alerts email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="edit-password"
            className="text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            New Password (Optional)
          </Label>
          <PasswordInput
            id="edit-password"
            placeholder="Leave blank to keep current password"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Role Permissions
          </Label>
          <div className="flex gap-2 pt-0.5">
            {["viewer", "operator", "admin"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setEditRole(r as "viewer" | "operator" | "admin")}
                className={cn(
                  "flex-1 py-2 px-3 border rounded-lg text-xs font-bold uppercase transition",
                  editRole === r
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-400"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-850 pt-4 mt-4">
          <div className="flex items-center justify-between gap-4 p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/30 rounded-xl">
            <div>
              <h5 className="text-xs font-bold text-red-800 dark:text-red-400">Reset Password</h5>
              <p className="text-[10px] font-semibold text-red-600/80 dark:text-red-400/60 leading-normal max-w-[240px] mt-0.5">
                Generates a new temporary credentials file and invalidates their current session.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={resettingPasswordUserId === (editingMember?.id || editingMember?._id)}
              onClick={handleResetPassword}
              className="h-9 text-[11px] px-3 font-bold bg-red-600 hover:bg-red-700 text-white border-transparent"
            >
              {resettingPasswordUserId === (editingMember?.id || editingMember?._id) ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </div>
      </div>
    </DynamicModal>
  );
}
