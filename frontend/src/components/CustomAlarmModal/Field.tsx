"use client";

import type React from "react";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  className,
  children,
  required,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className={className}>
      <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
