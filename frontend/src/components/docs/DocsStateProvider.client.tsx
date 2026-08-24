"use client";

import type { ReactNode, SetStateAction } from "react";
import { useSyncExternalStore } from "react";

type DocsState = {
  sidebarScroll: number;
  openGroups: Record<string, boolean>;
};

const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
    "Getting Started": true,
    "Cloud Setup": true,
    Operations: true,
    "AI Observability": true,
    Simulation: true,
    Support: true,
};

let docsState: DocsState = {
  sidebarScroll: 0,
  openGroups: DEFAULT_OPEN_GROUPS,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return docsState;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function updateDocsState(updater: (current: DocsState) => DocsState) {
  docsState = updater(docsState);
  emit();
}

export function setOpenGroups(value: SetStateAction<Record<string, boolean>>) {
  updateDocsState((current) => ({
    ...current,
    openGroups:
      typeof value === "function"
        ? (value as any)(current.openGroups)
        : value,
  }));
}

export function setSidebarScroll(value: SetStateAction<number>) {
  updateDocsState((current) => ({
    ...current,
    sidebarScroll:
      typeof value === "function"
        ? (value as any)(current.sidebarScroll)
        : value,
  }));
}

export function useDocsOpenGroups() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [snapshot.openGroups, setOpenGroups] as const;
}

export function useDocsSidebarScroll() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [snapshot.sidebarScroll, setSidebarScroll] as const;
}

export function DocsStateProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
