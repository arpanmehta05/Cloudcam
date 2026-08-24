"use client";

import { Loader2 } from "@/icons";

interface PhaseLoadingStateProps {
  title: string;
  description: string;
  spacious?: boolean;
}

export function PhaseLoadingState({
  title,
  description,
  spacious = false,
}: PhaseLoadingStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <p
        className={`text-xs text-muted-foreground leading-normal ${
          spacious ? "max-w-xs" : ""
        }`}
      >
        {description}
      </p>
    </div>
  );
}
