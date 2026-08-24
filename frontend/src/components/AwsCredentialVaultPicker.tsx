"use client";

import { useEffect, useState } from "react";
import { Check, Key, Loader2, ShieldCheck, Trash2 } from "@/icons";
import {
  deleteAwsCredential,
  loadSavedAwsCredentials,
  saveAwsCredential,
  type CredentialSelection,
  type SavedAwsCredential,
  unlockWithDevicePasskey,
} from "@/lib/aws-credential-vault";

type Props = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  disabled?: boolean;
  selection: CredentialSelection;
  onSelectionChange: (selection: CredentialSelection) => void;
};

export function AwsCredentialVaultPicker({
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  disabled,
  selection,
  onSelectionChange,
}: Props) {
  const [items, setItems] = useState<SavedAwsCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await loadSavedAwsCredentials());
    } catch (err: any) {
      setError(err.message || "Could not load saved keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const selectedItem = items.find(
    (item) => item.id === selection.credentialVaultId,
  );

  const handleUnlock = async (item: SavedAwsCredential) => {
    setError(null);
    try {
      await unlockWithDevicePasskey(item.name);
      onSelectionChange({
        mode: "saved",
        credentialVaultId: item.id,
        userPresenceVerified: true,
      });
    } catch (err: any) {
      setError(err.message || "Saved key use was cancelled");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveAwsCredential({
        name: name.trim() || `AWS key ${accessKeyId.slice(-4)}`,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        defaultRegion: region,
      });
      setName("");
      await refresh();
      await handleUnlock(saved);
    } catch (err: any) {
      setError(err.message || "Could not save this key");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: SavedAwsCredential) => {
    setError(null);
    try {
      await deleteAwsCredential(item.id);
      if (selection.credentialVaultId === item.id)
        onSelectionChange({ mode: "manual" });
      await refresh();
    } catch (err: any) {
      setError(err.message || "Could not delete saved key");
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-background/45 p-3">
      <div className="mb-3 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-foreground">
            AWS Credential Vault
          </p>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
            Save a named key only if you trust this workspace. It is encrypted
            at rest and must be verified locally before use.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading saved keys...
          </div>
        ) : items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-3 py-2"
            >
              <Key className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">
                  {item.name}
                </p>
                <p className="text-[10px] font-medium text-muted-foreground">
                  AKIA...{item.accessKeyIdLast4} ·{" "}
                  {item.defaultRegion || region}
                </p>
              </div>
              {selection.credentialVaultId === item.id &&
              selection.userPresenceVerified ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500">
                  <Check className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleUnlock(item)}
                  className="rounded-md border border-primary/30 px-2 py-1 text-[10px] font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50"
                >
                  Use
                </button>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDelete(item)}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                title="Delete saved key"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 px-3 py-3 text-[11px] font-medium text-muted-foreground">
            No saved AWS keys yet. You can keep entering credentials each time,
            or save this one after filling the fields below.
          </p>
        )}
      </div>

      {selection.mode === "saved" && selectedItem ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectionChange({ mode: "manual" })}
          className="mt-3 text-[10px] font-bold text-muted-foreground transition hover:text-foreground"
        >
          Use one-time credentials instead
        </button>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={disabled || saving || !accessKeyId || !secretAccessKey}
            placeholder="Name this key, e.g. Production admin"
            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground outline-none transition focus:border-primary/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || saving || !accessKeyId || !secretAccessKey}
            className="h-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-500 transition hover:bg-emerald-500/15 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save encrypted"}
          </button>
        </div>
      )}

      {error ? (
        <p className="mt-2 rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-[11px] font-semibold text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
