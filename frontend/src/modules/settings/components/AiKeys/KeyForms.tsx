"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Key,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  AlertCircle,
} from "@/icons";
import { KeyStatus } from "../../types";

interface ApiKeyInputProps {
  provider: "openai" | "anthropic" | "gemini" | "nvidia";
  label: string;
  placeholder: string;
  status: KeyStatus;
  onSave: (key: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ApiKeyInput({
  provider,
  label,
  placeholder,
  status,
  onSave,
  onDelete,
}: ApiKeyInputProps) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(key.trim());
      setKey("");
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-primary/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-mono uppercase tracking-wider">
                {label}
              </CardTitle>
              <CardDescription className="text-xs font-mono">
                {status.connected
                  ? `Connected ${status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}`
                  : "Not connected"}
              </CardDescription>
            </div>
          </div>
          {status.connected ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-[10px]"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> ACTIVE
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-muted text-muted-foreground border-border font-mono text-[10px]"
            >
              <XCircle className="w-3 h-3 mr-1" /> INACTIVE
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!status.connected ? (
          <>
            <div className="space-y-2">
              <Label
                htmlFor={`key-${provider}`}
                className="text-xs font-mono text-muted-foreground uppercase tracking-wider"
              >
                API Key
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`key-${provider}`}
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={placeholder}
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !key.trim()}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {error}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-mono text-muted-foreground">
              Key ending in ****{key ? key.slice(-4) : "••••"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" /> Remove
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
