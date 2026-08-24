"use client";

import { cn } from "@/lib/utils";

interface LivePulseProps {
  className?: string;
}

export function LivePulse({ className }: LivePulseProps) {
  return (
    <span
      aria-label="Live"
      className={cn("relative inline-flex h-3 w-3 shrink-0", className)}
      role="status"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60" />
      <span className="relative inline-flex h-full w-full rounded-full bg-[#22C55E] shadow-[0_0_0_3px_rgba(34,197,94,0.16)]" />
    </span>
  );
}
