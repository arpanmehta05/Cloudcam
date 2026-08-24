"use client";

import { useEffect, useState } from "react";
import { listEndUsers, type AiEndUserRow } from "../api";

export function useUsers() {
  const [users, setUsers] = useState<AiEndUserRow[]>([]);

  useEffect(() => {
    listEndUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  return { users };
}
