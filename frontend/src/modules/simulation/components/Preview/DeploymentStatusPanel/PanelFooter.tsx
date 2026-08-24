"use client";

export function PanelFooter() {
  return (
    <div className="border-t border-border bg-card/90 px-5 py-3.5 shrink-0 backdrop-blur">
      <p className="text-[9px] font-bold text-muted-foreground text-center uppercase tracking-wider">
        Secure Ephemeral Runner Container · Credentials destroyed immediately on exit
      </p>
    </div>
  );
}
