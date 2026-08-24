"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Pencil, RefreshCw, Trash2, User } from "@/icons";
import { initials } from "./shared";

interface TeamMembersCardProps {
  teamMembers: any[];
  loadingTeam: boolean;
  currentUserId?: string;
  revokingUserId: string | null;
  handleOpenEditModal: (member: any) => void;
  handleDeleteUser: (userIdToDelete: string) => void;
}

export function TeamMembersCard({
  teamMembers,
  loadingTeam,
  currentUserId,
  revokingUserId,
  handleOpenEditModal,
  handleDeleteUser,
}: TeamMembersCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 py-4 px-6">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
          Active Team Members
        </CardTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Team members registered under this tenant, with their respective roles and access levels.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loadingTeam ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-xs text-slate-500 mt-2">Loading team members...</p>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="h-10 w-10 text-slate-400" />
            <p className="text-xs text-slate-500 mt-2">No team members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30 font-bold text-slate-400 dark:border-slate-800/60 dark:bg-slate-900/5">
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Sign Up Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                {teamMembers.map((member) => {
                  const memberId = member.id || member._id || "";
                  const isSelf = memberId === currentUserId;
                  return (
                    <tr key={memberId} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Avatar className="h-8 w-8 shadow-sm">
                          <AvatarFallback className="bg-slate-900 text-[10px] font-extrabold text-white dark:bg-blue-600">
                            {initials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-slate-900 dark:text-white font-bold block">
                            {member.name} {isSelf && "(You)"}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 font-medium text-[10px] block mt-0.5">
                            {member.username ? `@${member.username}` : member.email}
                            {member.username && member.email && ` (${member.email})`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "px-2 py-0.5 text-[9px] font-bold rounded-sm uppercase tracking-wide",
                            member.permissionLevel === "admin" &&
                              "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/50",
                            member.permissionLevel === "operator" &&
                              "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50",
                            member.permissionLevel === "viewer" &&
                              "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-900/50"
                          )}
                        >
                          {member.permissionLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="text-slate-500 dark:text-slate-400 font-medium"
                          title={new Date(member.createdAt).toLocaleString()}
                        >
                          {new Intl.DateTimeFormat("en", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(new Date(member.createdAt))}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!isSelf && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditModal(member)}
                              className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition"
                              title="Edit user details & role"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={revokingUserId === memberId}
                              onClick={() => handleDeleteUser(memberId)}
                              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                              title="Revoke access"
                            >
                              {revokingUserId === memberId ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
