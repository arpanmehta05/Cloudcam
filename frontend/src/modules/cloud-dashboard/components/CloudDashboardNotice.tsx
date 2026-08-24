"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "@/icons";

type CloudDashboardNoticeVariant = "success" | "warning" | "error";

const noticeClasses: Record<CloudDashboardNoticeVariant, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
};

interface CloudDashboardNoticeProps {
    variant: CloudDashboardNoticeVariant;
    title?: string;
    message?: React.ReactNode;
    children?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
    icon?: React.ReactNode;
}

export function CloudDashboardNotice({
    variant,
    title,
    message,
    children,
    actions,
    className,
    icon,
}: CloudDashboardNoticeProps) {
    const Icon = variant === "success" ? CheckCircle2 : AlertTriangle;
    const renderedIcon = icon === undefined ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : icon;

    return (
        <Card className={`p-4 ${className || noticeClasses[variant]}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    {renderedIcon}
                    <div className="min-w-0">
                        {title && <p className="text-sm font-semibold">{title}</p>}
                        {message && <p className={title ? "mt-1 text-sm opacity-90" : "text-sm"}>{message}</p>}
                        {children}
                    </div>
                </div>
                {actions}
            </div>
        </Card>
    );
}
