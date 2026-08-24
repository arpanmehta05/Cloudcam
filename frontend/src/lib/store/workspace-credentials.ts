/**
 * File-backed store for workspace AWS credentials.
 *
 * Bridges the gap between:
 * 1. setup route (generates + saves externalId)
 * 2. save-role route (receives + saves roleArn from CF pingback)
 * 3. dashboard pages (reads roleArn + externalId to make API calls)
 *
 * In production, replace this with a real database (MongoDB, Postgres, etc.)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface WorkspaceCredentials {
    externalId?: string;
    roleArn?: string;
    connectedAt?: string;
}

const STORE_PATH = join(process.cwd(), ".credentials-store.json");

function readStore(): Record<string, WorkspaceCredentials> {
    if (!existsSync(STORE_PATH)) return {};
    try {
        return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
    } catch {
        return {};
    }
}

function writeStore(data: Record<string, WorkspaceCredentials>): void {
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function saveExternalId(workspaceId: string, externalId: string): void {
    const store = readStore();
    store[workspaceId] = { ...store[workspaceId], externalId };
    writeStore(store);
}

export function saveRoleArn(workspaceId: string, roleArn: string): void {
    const store = readStore();
    store[workspaceId] = { ...store[workspaceId], roleArn, connectedAt: new Date().toISOString() };
    writeStore(store);
}

export function saveConnection(workspaceId: string, roleArn: string, externalId: string): void {
    const store = readStore();
    store[workspaceId] = { roleArn, externalId, connectedAt: new Date().toISOString() };
    writeStore(store);
}

export function getCredentials(workspaceId: string): WorkspaceCredentials | null {
    const store = readStore();
    return store[workspaceId] || null;
}

export function isConnected(workspaceId: string): boolean {
    const creds = getCredentials(workspaceId);
    return !!(creds?.roleArn);
}
