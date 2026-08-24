"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "@/icons";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card", CARD_SHADOW, className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  route,
  description,
  actions,
}: {
  title: string;
  route?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-border bg-muted/55 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            SaaS control center
          </span>
          {route && (
            <code className="rounded-md border border-border/70 bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {route}
            </code>
          )}
        </div>
        <h1 className="text-[24px] font-semibold tracking-normal text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-none items-center gap-2.5">{actions}</div>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "default" | "ghost" | "danger";
};

export function Btn({ variant = "default", className, ...props }: BtnProps) {
  const styles: Record<string, string> = {
    primary:
      "text-primary-foreground border-transparent bg-primary shadow-sm hover:bg-primary/90",
    default: "border-border bg-card text-foreground hover:border-primary " + CARD_SHADOW,
    ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
    danger:
      "border-[color-mix(in_srgb,var(--destructive)_35%,var(--border))] bg-transparent text-destructive hover:bg-destructive/10",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function StatTile({
  label,
  value,
  delta,
  deltaTone = "good",
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaTone?: "good" | "warn";
}) {
  return (
    <Card className="p-4">
      <div className="text-[12.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
        {delta && (
          <span
            className={cn(
              "text-[12px] font-semibold",
              deltaTone === "good" ? "text-[var(--good,#16a34a)]" : "text-[var(--warn,#ea580c)]",
            )}
          >
            {delta}
          </span>
        )}
      </div>
    </Card>
  );
}

export function Toggle({
  checked,
  blocked,
  onClick,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  blocked?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative h-[22px] w-[38px] flex-none rounded-full transition disabled:opacity-60",
        blocked
          ? "bg-[color-mix(in_srgb,var(--destructive)_55%,var(--input))]"
          : checked
            ? "bg-primary"
            : "bg-input",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform",
          checked && "translate-x-[16px]",
        )}
      />
    </button>
  );
}

export function Pill({
  tone = "off",
  children,
}: {
  tone?: "good" | "off" | "blocked" | "info";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    good: "text-[var(--good,#16a34a)] bg-[color-mix(in_srgb,var(--good,#16a34a)_15%,transparent)]",
    off: "text-muted-foreground bg-muted",
    blocked: "text-destructive bg-destructive/10",
    info: "text-accent-foreground bg-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] text-foreground outline-none focus:border-primary focus:outline-2 focus:outline-ring",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Btn variant="default" onClick={onRetry}>
          Try again
        </Btn>
      )}
    </Card>
  );
}

export function SectionHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
      <b className="text-sm font-semibold">{title}</b>
      {meta && <span className="text-[12px] text-muted-foreground">{meta}</span>}
      {action}
    </div>
  );
}
