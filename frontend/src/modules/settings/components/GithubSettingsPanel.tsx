"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Github, GitBranch, Loader2, Plug, RefreshCw, Trash2 } from "@/icons";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useGithubSettings } from "../hooks/useGithubSettings";

export function GithubSettingsPanel() {
  const { user } = useAuth();
  const {
    connected,
    repos,
    visibleRepos,
    loading,
    reposLoading,
    disconnecting,
    error,
    loadGithub,
    connectGithub,
    disconnectGithub,
  } = useGithubSettings();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg border border-[#D8E4F8] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-[#24344D] dark:bg-[#0B1728] dark:shadow-none lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]">
            <Github className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-normal text-[#0F172A] dark:text-white">
                GitHub Connection
              </h1>
              {connected ? (
                <Badge className="bg-[#DCFCE7] text-[#166534] hover:bg-[#DCFCE7] dark:bg-[#052E16] dark:text-[#86EFAC]">
                  Connected
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[#64748B] dark:text-[#94A3B8]">
              Connect GitHub so IaC simulations and deployment workflows can
              browse repositories and branches without asking for a manual
              token.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={loadGithub}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", loading ? "animate-spin" : "")}
            />
            Refresh
          </Button>
          {connected ? (
            <Button
              variant="outline"
              onClick={disconnectGithub}
              disabled={disconnecting}
              className="gap-2 border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2] dark:border-[#7F1D1D] dark:text-[#FCA5A5] dark:hover:bg-[#3B1218]"
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={connectGithub}
              disabled={loading}
              className="gap-2 bg-[#0F172A] text-white hover:bg-[#1E293B] dark:bg-white dark:text-[#0F172A] dark:hover:bg-[#E2E8F0]"
            >
              <Plug className="h-4 w-4" />
              Connect GitHub
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-bold text-[#B91C1C] dark:border-[#7F1D1D] dark:bg-[#3B1218] dark:text-[#FCA5A5]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
            <CardDescription>
              Current Git provider access for this workspace user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-[#24344D] dark:bg-[#07111F]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#1A56DB] dark:bg-[#13233A] dark:text-[#6BA3F8]">
                  <Github className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    GitHub account
                  </p>
                  <p className="truncate text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    {user?.email || "Signed in user"}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-2 text-sm font-bold">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] py-3 dark:border-[#24344D]">
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  Repository access
                </span>
                <span className="text-[#0F172A] dark:text-white">
                  {connected ? "Enabled" : "Not connected"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] py-3 dark:border-[#24344D]">
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  Repositories loaded
                </span>
                <span className="text-[#0F172A] dark:text-white">
                  {repos.length}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  Used by
                </span>
                <span className="text-right text-[#0F172A] dark:text-white">
                  Simulation IaC workflows
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
            <CardDescription>
              Recent GitHub repositories available for IaC workflow history and
              branch selection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || reposLoading ? (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] text-sm font-bold text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading GitHub repositories
              </div>
            ) : !connected ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] px-6 text-center dark:border-[#334155]">
                <Github className="mb-3 h-8 w-8 text-[#64748B] dark:text-[#94A3B8]" />
                <p className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  GitHub is not connected yet
                </p>
                <p className="mt-1 max-w-md text-sm font-semibold leading-6 text-[#64748B] dark:text-[#94A3B8]">
                  Connect your account to list repositories and use them in
                  GitHub simulation nodes.
                </p>
              </div>
            ) : repos.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] text-sm font-bold text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">
                No repositories were returned by GitHub.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleRepos.map((repo) => (
                  <div
                    key={repo.fullName}
                    className="rounded-lg border border-[#E2E8F0] bg-white p-4 dark:border-[#24344D] dark:bg-[#07111F]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-[#0F172A] dark:text-white">
                          {repo.fullName}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[#64748B] dark:text-[#94A3B8]">
                          {repo.description ||
                            "No repository description provided."}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {repo.private ? "Private" : "Public"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                      <GitBranch className="h-3.5 w-3.5" />
                      {repo.defaultBranch || "default branch"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
