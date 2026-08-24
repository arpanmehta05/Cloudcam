"use client";

import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}

export function StatCard({ icon: Icon, label, value, sub }: StatCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-lg font-mono font-bold text-foreground leading-tight">
              {value}
            </p>
            {sub && (
              <p className="text-[10px] font-mono text-muted-foreground">
                {sub}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
