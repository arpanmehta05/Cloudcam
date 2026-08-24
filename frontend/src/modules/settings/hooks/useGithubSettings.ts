import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { settingsApi } from "../api/settings.api";
import { GithubRepo } from "../types";
import { startOAuthFlow } from "@/lib/oauth";

export function useGithubSettings() {
  const { refreshUser } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [reposLoading, setReposLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRepos = useMemo(() => repos.slice(0, 8), [repos]);

  const loadGithub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await settingsApi.getGithubStatus();
      setConnected(status.connected);
      if (status.connected) {
        setReposLoading(true);
        try {
          const repoData = await settingsApi.getGithubRepos();
          setRepos(repoData.repos);
        } finally {
          setReposLoading(false);
        }
      } else {
        setRepos([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load GitHub connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGithub();
  }, [loadGithub]);

  const connectGithub = async () => {
    setError(null);
    sessionStorage.setItem("connect_github", "true");
    sessionStorage.setItem("github_redirect_back", "/settings/github");
    await startOAuthFlow("github");
  };

  const disconnectGithub = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await settingsApi.disconnectGithub();
      setConnected(false);
      setRepos([]);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || "Failed to disconnect GitHub.");
    } finally {
      setDisconnecting(false);
    }
  };

  return {
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
  };
}
