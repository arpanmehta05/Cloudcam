"use client";

import { useCallback, useEffect, useState } from "react";
import { setupApi, type AiIngestKey } from "../api";

export function useIngestKeys() {
  const [keys, setKeys] = useState<AiIngestKey[]>([]);
  const [name, setName] = useState("production support-api");
  const [createdKey, setCreatedKey] = useState<AiIngestKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setKeys(await setupApi.listIngestKeys());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createKey() {
    setCreating(true);
    try {
      const key = await setupApi.createIngestKey({
        name,
        scopes: ["events:write", "traces:write"],
      });
      setCreatedKey(key);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    await setupApi.revokeIngestKey(id);
    await refresh();
  }

  return {
    keys,
    name,
    setName,
    createdKey,
    loading,
    creating,
    createKey,
    revokeKey,
  };
}
