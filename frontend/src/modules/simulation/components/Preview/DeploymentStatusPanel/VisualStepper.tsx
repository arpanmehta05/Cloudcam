"use client";

import React from "react";
import { Check } from "@/icons";

interface Step {
  label: string;
}

interface VisualStepperProps {
  steps: Step[];
  activeStep: number;
}

export function VisualStepper({ steps, activeStep }: VisualStepperProps) {
  return (
    <div className="mb-5 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm shrink-0">
      <div className="relative flex items-center justify-between px-2">
        <div className="absolute left-4 right-4 top-3.5 h-0.5 -translate-y-1/2 bg-muted dark:bg-slate-800" />
        <div
          className="absolute left-4 top-3.5 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300"
          style={{
            width: `${(activeStep / (steps.length - 1)) * 88}%`,
          }}
        />

        {steps.map((step, idx) => {
          const isCompleted = idx < activeStep;
          const isActive = idx === activeStep;
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105"
                      : "bg-muted text-muted-foreground border border-border dark:bg-slate-900"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span
                className={`mt-1.5 text-[9px] font-bold uppercase tracking-wider ${
                  isActive ? "text-primary font-extrabold" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
