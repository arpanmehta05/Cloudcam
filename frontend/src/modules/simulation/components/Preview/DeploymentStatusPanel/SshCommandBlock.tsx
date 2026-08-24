"use client";

import { useState } from "react";
import { Terminal, Check, Copy } from "@/icons";

export function SshCommandBlock({
  label,
  ip,
  defaultUsername,
  defaultKeyName,
  provider,
}: {
  label: string;
  ip: string;
  defaultUsername: string;
  defaultKeyName: string;
  provider: "aws" | "azure" | "gcp";
}) {
  const [username, setUsername] = useState(defaultUsername);
  const [keyName, setKeyName] = useState(defaultKeyName);
  const [copied, setCopied] = useState(false);
  const command = `ssh -i "${keyName}.pem" ${username}@${ip}`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left space-y-3 select-text">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-bold text-foreground">{label}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Configure connection details below to generate the SSH command.
      </p>

      {/* SSH Username Input and Quick-Select */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="h-8 w-full rounded border border-border bg-background px-2 text-xs font-semibold text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          placeholder="e.g. ubuntu"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(provider === "aws"
            ? ["ec2-user", "ubuntu", "admin", "root", "centos", "debian"]
            : provider === "azure"
              ? ["azureuser", "ubuntu", "admin", "root"]
              : ["cloudwatcher", "ubuntu", "admin", "root"]
          ).map((usr) => (
            <button
              key={usr}
              type="button"
              onClick={() => setUsername(usr)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-all border ${
                username === usr
                  ? "bg-blue-500/20 border-blue-500 text-blue-400"
                  : "bg-black/10 border-border/30 text-muted-foreground hover:text-foreground hover:bg-black/20"
              }`}
            >
              {usr}
            </button>
          ))}
        </div>
      </div>

      {/* Private Key Name Input */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
          Key File Name (.pem)
        </label>
        <div className="flex items-center rounded border border-border bg-background px-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            className="h-8 w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none"
            placeholder="e.g. my-key"
          />
          <span className="text-[10px] font-bold text-muted-foreground/60 select-none pr-1">
            .pem
          </span>
        </div>
      </div>

      {/* SSH Command Box */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
          Generated Command
        </label>
        <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 font-mono text-[10px] text-slate-100 select-all break-all pr-12">
          <span>{command}</span>
          <button
            onClick={handleCopy}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy to Clipboard"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
