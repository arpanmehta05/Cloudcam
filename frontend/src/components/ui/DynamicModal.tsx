"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./dialog";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Loader2 } from "@/icons";

export interface DynamicModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children?: React.ReactNode;
    type?: "info" | "success" | "warning" | "danger" | "default";
    size?: "sm" | "md" | "lg" | "xl" | "2xl";
    primaryAction?: {
        label: string;
        onClick: () => void | Promise<void>;
        disabled?: boolean;
        isLoading?: boolean;
        variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "emerald";
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
        disabled?: boolean;
    };
}

const icons = {
    info: <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
    success: <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
    warning: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
    danger: <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />,
    default: null,
};

const bgColors = {
    info: "bg-blue-50 dark:bg-blue-950/20",
    success: "bg-emerald-50 dark:bg-emerald-950/20",
    warning: "bg-amber-50 dark:bg-amber-950/20",
    danger: "bg-rose-50 dark:bg-rose-950/20",
    default: "",
};

const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
};

export function DynamicModal({
    isOpen,
    onClose,
    title,
    description,
    children,
    type = "default",
    size = "md",
    primaryAction,
    secondaryAction,
}: DynamicModalProps) {
    const icon = icons[type];
    const bgIcon = bgColors[type];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={cn("w-full overflow-hidden p-0", sizeClasses[size])}>
                <div className="p-6">
                    <div className={cn("flex gap-4", icon ? "items-start" : "items-center")}>
                        {icon && (
                            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm", bgIcon)}>
                                {icon}
                            </div>
                        )}
                        <div className="flex-1 space-y-1">
                            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                                {title}
                            </DialogTitle>
                            {description && (
                                <DialogDescription className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {description}
                                </DialogDescription>
                            )}
                        </div>
                    </div>

                    {children && <div className="mt-5 text-sm">{children}</div>}
                </div>

                {(primaryAction || secondaryAction) && (
                    <DialogFooter className="bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-850 px-6 py-4 flex flex-row items-center justify-end gap-2">
                        {secondaryAction && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={secondaryAction.onClick}
                                disabled={secondaryAction.disabled || primaryAction?.isLoading}
                                className="h-10 px-4 text-xs font-bold border-slate-200 dark:border-slate-800"
                            >
                                {secondaryAction.label}
                            </Button>
                        )}
                        {primaryAction && (
                            <Button
                                type="button"
                                variant={
                                    primaryAction.variant === "emerald" 
                                        ? "default" 
                                        : (primaryAction.variant || "default")
                                }
                                onClick={primaryAction.onClick}
                                disabled={primaryAction.disabled || primaryAction.isLoading}
                                className={cn(
                                    "h-10 px-4 text-xs font-bold gap-2 min-w-[80px]",
                                    primaryAction.variant === "emerald" && "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                                )}
                            >
                                {primaryAction.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                {primaryAction.label}
                            </Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
