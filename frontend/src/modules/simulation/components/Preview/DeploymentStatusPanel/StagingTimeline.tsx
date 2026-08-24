"use client";

import { Check, Loader2, Clock } from "@/icons";
import { Badge } from "@/components/ui/badge";

interface StagingTimelineProps {
  hasEcr: boolean;
  stage1Status: "active" | "completed" | "pending";
  stage2Status: "active" | "completed" | "pending";
  stage3Status: "active" | "completed" | "pending";
}

export function StagingTimeline({
  hasEcr,
  stage1Status,
  stage2Status,
  stage3Status,
}: StagingTimelineProps) {
  if (!hasEcr) return null;

  const stages = [
    {
      title: "Stage 1: ECR Registry Setup",
      desc: "Creating ECR repository and policies",
      status: stage1Status,
    },
    {
      title: "User Action: Docker Image Upload",
      desc: "Build & push container to ECR repository",
      status: stage2Status,
    },
    {
      title: "Stage 2: Compute Provisioning",
      desc: "Deploy EC2 instance & launch container",
      status: stage3Status,
    },
  ];

  return (
    <div className="mb-6 rounded-xl border border-border bg-card/40 p-4.5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
          Staging Deployment Pipeline
        </span>
        <Badge variant="outline" className="bg-primary/5 text-primary text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 animate-none">
          2-Stage Orchestration
        </Badge>
      </div>
      <div className="space-y-4">
        {stages.map((stage, idx) => {
          const isActive = stage.status === "active";
          const isCompleted = stage.status === "completed";
          return (
            <div key={idx} className="flex items-start gap-3 relative">
              {idx < stages.length - 1 && (
                <div
                  className={`absolute left-2.5 top-5 bottom-[-16px] w-0.5 transition-colors duration-300 ${
                    isCompleted ? "bg-emerald-500" : "bg-muted dark:bg-slate-800"
                  }`}
                />
              )}
              <div
                className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 z-10 ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-amber-500 text-white ring-4 ring-amber-500/20 scale-105"
                      : "bg-muted text-muted-foreground border border-border dark:bg-slate-900"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs font-bold leading-none block transition-colors ${
                    isActive
                      ? "text-amber-500"
                      : isCompleted
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                  }`}
                >
                  {stage.title}
                </span>
                <span className="text-[10px] text-muted-foreground leading-normal mt-0.5 block">
                  {stage.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
