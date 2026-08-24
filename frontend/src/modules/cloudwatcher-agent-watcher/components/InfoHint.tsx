"use client";

import { Info } from "@/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-grid h-5 w-5 place-items-center rounded-full border border-[#BFDBFE] bg-white text-[#1A56DB] transition-colors hover:bg-[#EFF6FF] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          className="max-w-[280px] border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-xs leading-5 text-white shadow-xl"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
